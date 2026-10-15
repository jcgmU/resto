import {
  CancelOrderUseCase,
  CatalogValidationPort,
  CartRepository,
  ConfirmOrderUseCase,
  EventPublisher,
  GetOrderHistoryUseCase,
  GetOrderUseCase,
  ListSessionOrdersUseCase,
  ListTenantOrdersUseCase,
  OrderDTO,
  OrderRepository,
  SessionServicePort,
  UpdateOrderDelayUseCase,
  UpdateOrderStatusUseCase,
  IdentitySettingsPort,
} from '@packages/shared-types';
import {
  CartEmptyError,
  ForbiddenError,
  OrderNotFoundError,
  InvalidStatusTransitionError,
  SessionNotOrderableError,
  TableMismatchError,
  ValidationError,
} from '../domain/errors';
import { canTransition } from '../domain/orderStatusMachine';
import { validateAndPriceCart } from '../domain/pricing';
import { config } from '../config';

export class OrderUseCases {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly cartRepo: CartRepository,
    private readonly catalogValidation: CatalogValidationPort,
    private readonly eventPublisher?: EventPublisher,
    private readonly sessionService?: SessionServicePort,
    private readonly identitySettings?: IdentitySettingsPort
  ) {}

  updateOrderStatus: UpdateOrderStatusUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!canTransition(order.status, input.status)) {
        throw new InvalidStatusTransitionError();
      }

      const updated = await this.orderRepo.updateStatus(
        input.tenantId,
        input.orderId,
        input.status,
        new Date()
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.status-changed',
          order: updated,
          previousStatus: order.status,
          occurredAt: new Date().toISOString(),
        });
      }

      return updated;
    },
  };

  confirmOrder: ConfirmOrderUseCase = {
    execute: async (input) => {
      let effectiveTableId = input.tableId || '';
      if (this.sessionService) {
        const session = await this.sessionService.getSession(input.tenantId, input.sessionId);
        if (!session || session.status !== 'active') {
          throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
        }
        if (input.tableId && session.tableId && session.tableId !== '*' && input.tableId !== session.tableId) {
          throw new TableMismatchError('La mesa indicada no coincide con la mesa de la sesión');
        }
        effectiveTableId = (session.tableId && session.tableId !== '*') ? session.tableId : (input.tableId || 'default-table');
      }

      if (this.identitySettings) {
        const isStaff = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER'].includes((input.userRole || '').toUpperCase());
        if (!isStaff) {
          const mode = await this.identitySettings.getOperatingMode(input.tenantId);
          if (mode === 'waiter_only') {
            throw new SessionNotOrderableError('El autoservicio por QR está inactivo en modo solo meseros');
          }
        }
      }

      if (input.notes !== undefined && input.notes !== null) {
        if (typeof input.notes !== 'string' || input.notes.length > 280) {
          throw new ValidationError('Las notas generales no pueden superar 280 caracteres');
        }
      }

      // Snapshot atómico / vaciado del carrito para evitar doble confirmación ante solicitudes concurrentes
      const cart = this.cartRepo.takeSnapshot
        ? await this.cartRepo.takeSnapshot(input.tenantId, input.sessionId)
        : await this.cartRepo.get(input.tenantId, input.sessionId, config.cartTtlSeconds);

      if (!cart.items || cart.items.length === 0) {
        throw new CartEmptyError();
      }

      try {
        const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
        const validatedProducts = await this.catalogValidation.getOrderableProducts(
          input.tenantId,
          productIds
        );

        const priced = validateAndPriceCart(cart.items, validatedProducts);

        const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const order: OrderDTO = {
          id: orderId,
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          tableId: effectiveTableId,
          status: 'PLACED',
          total: priced.total,
          items: priced.items,
          notes: input.notes && input.notes.trim() !== '' ? input.notes.trim() : undefined,
          estimatedMinutes: input.estimatedMinutes,
          delayMinutes: 0,
          overdue: false,
          createdAt: new Date().toISOString(),
        };

        // Guardar orden (atómico)
        const savedOrder = await this.orderRepo.save(input.tenantId, order);

        // Si el repositorio no implementa takeSnapshot atómico, limpiar explícitamente
        if (!this.cartRepo.takeSnapshot) {
          await this.cartRepo.clear(input.tenantId, input.sessionId);
        }

        // Publicar evento solo tras commit exitoso
        if (this.eventPublisher) {
          await this.eventPublisher.publishOrderEvent(input.tenantId, {
            type: 'order.created',
            order: savedOrder,
            occurredAt: new Date().toISOString(),
          });
        }

        return savedOrder;
      } catch (err) {
        // En caso de fallo antes de persistir la orden, restaurar el carrito
        if (this.cartRepo.takeSnapshot && this.cartRepo.restoreCart) {
          await this.cartRepo
            .restoreCart(input.tenantId, input.sessionId, cart, config.cartTtlSeconds)
            .catch(() => {});
        }
        throw err;
      }
    },
  };

  getOrder: GetOrderUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (input.requester.role === 'guest' && order.sessionId !== input.requester.sessionId) {
        throw new ForbiddenError('No puedes ver órdenes de otra mesa');
      }

      return order;
    },
  };

  getOrderHistory: GetOrderHistoryUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      const role = input.requester.role?.toLowerCase();
      const isStaff = role && ['staff', 'manager', 'admin'].includes(role);
      if (!isStaff && order.sessionId !== input.requester.sessionId) {
        throw new ForbiddenError('No puedes ver el historial de órdenes de otra mesa');
      }

      if (!this.orderRepo.getOrderHistory) {
        return [];
      }

      return this.orderRepo.getOrderHistory(input.tenantId, input.orderId);
    },
  };

  updateOrderDelay: UpdateOrderDelayUseCase = {
    execute: async (input) => {
      if (
        input.delayMinutes === undefined ||
        typeof input.delayMinutes !== 'number' ||
        !Number.isInteger(input.delayMinutes) ||
        input.delayMinutes < 0
      ) {
        throw new ValidationError('delayMinutes debe ser un número entero mayor o igual a 0');
      }

      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!this.orderRepo.updateDelay) {
        throw new Error('updateDelay no implementado');
      }

      const updated = await this.orderRepo.updateDelay(
        input.tenantId,
        input.orderId,
        input.delayMinutes
      );

      return updated;
    },
  };

  listSessionOrders: ListSessionOrdersUseCase = {
    execute: async (input) => {
      return this.orderRepo.listBySession(input.tenantId, input.sessionId);
    },
  };

  listTenantOrders: ListTenantOrdersUseCase = {
    execute: async (input) => {
      return this.orderRepo.listByTenant(input.tenantId, input.filter);
    },
  };

  cancelOrder: CancelOrderUseCase = {
    execute: async (input) => {
      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!canTransition(order.status, 'CANCELLED')) {
        throw new InvalidStatusTransitionError();
      }

      const cancelled = await this.orderRepo.cancel(input.tenantId, input.orderId, new Date());

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.status-changed',
          order: cancelled,
          previousStatus: order.status,
          occurredAt: new Date().toISOString(),
        });
      }

      return cancelled;
    },
  };
}
