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
  OrderAlreadyTerminalError,
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

      const hasKitchen = order.items.some((i) => (i.destination || 'kitchen') === 'kitchen');
      const hasBar = order.items.some((i) => i.destination === 'bar');

      let targetKitchenStatus = order.kitchenStatus || (hasKitchen ? order.status : undefined);
      let targetBarStatus = order.barStatus || (hasBar ? order.status : undefined);

      if (input.destination === 'kitchen') {
        const currentDestStatus = targetKitchenStatus || 'PLACED';
        if (!canTransition(currentDestStatus, input.status)) {
          throw new InvalidStatusTransitionError();
        }
        targetKitchenStatus = input.status;
      } else if (input.destination === 'bar') {
        const currentDestStatus = targetBarStatus || 'PLACED';
        if (!canTransition(currentDestStatus, input.status)) {
          throw new InvalidStatusTransitionError();
        }
        targetBarStatus = input.status;
      } else {
        if (!canTransition(order.status, input.status)) {
          throw new InvalidStatusTransitionError();
        }
        if (hasKitchen) targetKitchenStatus = input.status;
        if (hasBar) targetBarStatus = input.status;
      }

      const STATUS_RANK: Record<string, number> = {
        PLACED: 1,
        IN_KITCHEN: 2,
        READY: 3,
        DELIVERED: 4,
        CANCELLED: 99,
      };

      let computedGlobalStatus: any = input.status;
      if (input.status === 'CANCELLED') {
        computedGlobalStatus = 'CANCELLED';
      } else {
        const activeStatuses: any[] = [];
        if (hasKitchen && targetKitchenStatus) activeStatuses.push(targetKitchenStatus);
        if (hasBar && targetBarStatus) activeStatuses.push(targetBarStatus);

        if (activeStatuses.length > 0) {
          activeStatuses.sort((a, b) => (STATUS_RANK[a] ?? 0) - (STATUS_RANK[b] ?? 0));
          computedGlobalStatus = activeStatuses[0];
        } else {
          computedGlobalStatus = input.status;
        }
      }

      const updated = await this.orderRepo.updateStatus(
        input.tenantId,
        input.orderId,
        computedGlobalStatus,
        new Date(),
        {
          kitchenStatus: targetKitchenStatus,
          barStatus: targetBarStatus,
        }
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.status-changed',
          order: updated,
          previousStatus: order.status,
          destination: input.destination,
          occurredAt: new Date().toISOString(),
        } as any);
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

        const isStaff = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER'].includes((input.userRole || '').toUpperCase());

        let effectiveEstimatedMinutes = 18;
        if (this.identitySettings) {
          try {
            const tenantMinutes = await this.identitySettings.getEstimatedPrepMinutes(input.tenantId);
            if (typeof tenantMinutes === 'number' && !isNaN(tenantMinutes)) {
              effectiveEstimatedMinutes = Math.min(120, Math.max(5, tenantMinutes));
            }
          } catch {
            effectiveEstimatedMinutes = 18;
          }
        }

        if (isStaff && input.estimatedMinutes !== undefined && input.estimatedMinutes !== null) {
          effectiveEstimatedMinutes = Math.min(120, Math.max(5, input.estimatedMinutes));
        }

        const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const hasKitchen = priced.items.some((i) => (i.destination || 'kitchen') === 'kitchen');
        const hasBar = priced.items.some((i) => i.destination === 'bar');

        const order: OrderDTO = {
          id: orderId,
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          tableId: effectiveTableId,
          status: 'PLACED',
          kitchenStatus: hasKitchen ? 'PLACED' : undefined,
          barStatus: hasBar ? 'PLACED' : undefined,
          destinationStatus: {
            ...(hasKitchen ? { kitchen: 'PLACED' } : {}),
            ...(hasBar ? { bar: 'PLACED' } : {}),
          },
          total: priced.total,
          items: priced.items,
          notes: input.notes && input.notes.trim() !== '' ? input.notes.trim() : undefined,
          estimatedMinutes: effectiveEstimatedMinutes,
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
      const isStaff = role && ['staff', 'manager', 'admin', 'monitor', 'waiter'].includes(role);
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
        input.delayMinutes < 1 ||
        input.delayMinutes > 120
      ) {
        throw new ValidationError('delayMinutes debe ser un número entero entre 1 y 120');
      }

      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
        throw new OrderAlreadyTerminalError('No se puede asignar demora a una orden en estado terminal');
      }

      if (!this.orderRepo.updateDelay) {
        throw new Error('updateDelay no implementado');
      }

      const updated = await this.orderRepo.updateDelay(
        input.tenantId,
        input.orderId,
        input.delayMinutes
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishOrderEvent(input.tenantId, {
          type: 'order.delay-updated',
          order: updated,
          delayMinutes: input.delayMinutes,
          occurredAt: new Date().toISOString(),
        } as any);
      }

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
