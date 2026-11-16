import { randomUUID } from 'crypto';
import {
  CancelOrderUseCase,
  CatalogValidationPort,
  CartDTO,
  CartItemDTO,
  CartRepository,
  ConfirmOrderUseCase,
  EventPublisher,
  GetOrderHistoryUseCase,
  GetOrderUseCase,
  ListSessionOrdersUseCase,
  ListTenantOrdersUseCase,
  OrderDTO,
  OrderRepository,
  OrderStatus,
  PaymentRepository,
  SessionServicePort,
  UpdateOrderDelayUseCase,
  UpdateOrderStatusUseCase,
  IdentitySettingsPort,
} from '@packages/shared-types';
import {
  CartBusyError,
  CartEmptyError,
  ForbiddenError,
  OrderNotFoundError,
  InvalidStatusTransitionError,
  SessionNotOrderableError,
  TableMismatchError,
  ValidationError,
  OrderAlreadyTerminalError,
  SessionNotActiveError,
  SessionUnreachableError,
  DomainError,
} from '../domain/errors';
import { canTransition } from '../domain/orderStatusMachine';
import { validateAndPriceCart } from '../domain/pricing';
import { OrderingSessionPort } from '../domain/sessionValidation';
import { TransactionCoordinator } from './ports/TransactionCoordinator';
import { config } from '../config';
import { ORDER_HISTORY_ROLES, hasRole } from '../interfaces/http/authzRoles';
import {
  isOperationInFlight,
  markOperationInFlight,
  markOperationFinished,
} from './ports/CartReservationPort';

export class OrderUseCases {
  private readonly paymentRepo?: PaymentRepository;
  private readonly sessionService?: SessionServicePort | OrderingSessionPort;
  private readonly identitySettings?: IdentitySettingsPort;
  private readonly txCoordinator?: TransactionCoordinator;

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly cartRepo: CartRepository,
    private readonly catalogValidation: CatalogValidationPort,
    private readonly eventPublisher?: EventPublisher,
    arg5?: PaymentRepository | SessionServicePort | OrderingSessionPort,
    arg6?: OrderingSessionPort | SessionServicePort | IdentitySettingsPort,
    arg7?: TransactionCoordinator | IdentitySettingsPort,
    arg8?: IdentitySettingsPort
  ) {
    if (arg5) {
      if ('findBySession' in arg5) {
        this.paymentRepo = arg5 as PaymentRepository;
      } else if ('getSession' in arg5 || 'closeSession' in arg5) {
        this.sessionService = arg5 as any;
      }
    }

    if (arg6) {
      if ('getSession' in arg6 || 'closeSession' in arg6) {
        this.sessionService = arg6 as any;
      } else if ('getOperatingMode' in arg6 || 'getEstimatedPrepMinutes' in arg6) {
        this.identitySettings = arg6 as IdentitySettingsPort;
      }
    }

    if (arg7) {
      if ('runInSessionLock' in arg7) {
        this.txCoordinator = arg7 as TransactionCoordinator;
      } else if ('getOperatingMode' in arg7 || 'getEstimatedPrepMinutes' in arg7) {
        this.identitySettings = arg7 as IdentitySettingsPort;
      }
    }

    if (arg8 && ('getOperatingMode' in arg8 || 'getEstimatedPrepMinutes' in arg8)) {
      this.identitySettings = arg8 as IdentitySettingsPort;
    }
  }

  updateOrderStatus = {
    execute: async (input: {
      tenantId: string;
      orderId: string;
      status: OrderStatus;
      destination?: 'kitchen' | 'bar';
      requesterRole?: string;
    }): Promise<OrderDTO> => {
      if (input.status === 'CANCELLED' && input.requesterRole && input.requesterRole.toLowerCase() === 'staff') {
        throw new ForbiddenError('Solo personal administrativo puede cancelar órdenes');
      }

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

      let updated: OrderDTO;
      if (input.status === 'CANCELLED') {
        updated = await this.orderRepo.cancel(input.tenantId, input.orderId, new Date());
      } else {
        updated = await this.orderRepo.updateStatus(
          input.tenantId,
          input.orderId,
          computedGlobalStatus,
          new Date(),
          {
            kitchenStatus: targetKitchenStatus,
            barStatus: targetBarStatus,
          }
        );
      }

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
      // 1. Validar sesión y derivar mesa efectiva
      let effectiveTableId = input.tableId || '';

      if (this.sessionService?.getSession) {
        let session: any = null;
        try {
          session = await this.sessionService.getSession(input.tenantId, input.sessionId);
        } catch (err: any) {
          if (err instanceof DomainError) throw err;
          throw new SessionUnreachableError(
            `Fallo al conectar con el microservicio de sesión: ${err.message}`
          );
        }

        if (!session || session.status !== 'active') {
          throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
        }
        if (input.tableId && session.tableId && session.tableId !== '*' && input.tableId !== session.tableId) {
          throw new TableMismatchError('La mesa indicada no coincide con la mesa de la sesión');
        }
        effectiveTableId =
          session.tableId && session.tableId !== '*'
            ? session.tableId
            : input.tableId || 'default-table';
      } else {
        effectiveTableId = input.tableId || 'default-table';
      }

      if (this.paymentRepo) {
        const payment = await (this.paymentRepo as any).findBySession(
          input.tenantId,
          input.sessionId
        );
        if (payment) {
          throw new SessionNotActiveError('La sesión ya ha sido pagada');
        }
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

      // 2. Comprobar y recuperar reserva huérfana si existe y no está en vuelo
      const reservationRepo = this.cartRepo as any;
      const hasReservationPort =
        'reserveCart' in this.cartRepo && typeof reservationRepo.reserveCart === 'function';

      if (hasReservationPort) {
        const pending = await reservationRepo.findReservation(input.tenantId, input.sessionId);
        if (pending) {
          const isLeaseActive =
            typeof reservationRepo.isReservationLeaseActive === 'function'
              ? await reservationRepo.isReservationLeaseActive(
                  input.tenantId,
                  input.sessionId,
                  pending.operationId
                )
              : isOperationInFlight(pending.operationId);

          if (isLeaseActive) {
            throw new CartBusyError();
          }

          const recoverWork = async (
            tx?: any
          ): Promise<{
            action: 'ACK' | 'RESTORE';
            existingOrder?: OrderDTO | null;
          }> => {
            const currentPending = await reservationRepo.findReservation(input.tenantId, input.sessionId);
            if (!currentPending || currentPending.operationId !== pending.operationId) {
              return { action: 'RESTORE' };
            }
            if (typeof reservationRepo.isReservationLeaseActive === 'function') {
              const stillActive = await reservationRepo.isReservationLeaseActive(
                input.tenantId,
                input.sessionId,
                currentPending.operationId
              );
              if (stillActive) {
                throw new CartBusyError();
              }
            }

            const fenceRepo = this.orderRepo as any;
            let fenceStatus: 'COMMITTED' | 'ABORTED' = 'ABORTED';
            if (typeof fenceRepo.abortReservationFence === 'function') {
              fenceStatus = await fenceRepo.abortReservationFence(
                input.tenantId,
                input.sessionId,
                currentPending.operationId,
                currentPending.orderId,
                tx
              );
            }

            if (fenceStatus === 'COMMITTED') {
              const existing = await (this.orderRepo as any).findById(
                input.tenantId,
                currentPending.orderId,
                tx
              );
              return { action: 'ACK', existingOrder: existing };
            }

            return { action: 'RESTORE' };
          };

          const recoveryDecision = this.txCoordinator
            ? await this.txCoordinator.runInSessionLock(
                input.tenantId,
                input.sessionId,
                recoverWork
              )
            : await recoverWork();

          if (recoveryDecision?.action === 'ACK') {
            await reservationRepo.ackReservation(
              input.tenantId,
              input.sessionId,
              pending.operationId
            );
            if (recoveryDecision.existingOrder) {
              const liveCart = await this.cartRepo.get(
                input.tenantId,
                input.sessionId,
                config.cartTtlSeconds
              );
              if (!liveCart.items || liveCart.items.length === 0) {
                return recoveryDecision.existingOrder;
              }
            }
          } else if (recoveryDecision?.action === 'RESTORE') {
            const restored = await reservationRepo.restoreReservation(
              input.tenantId,
              input.sessionId,
              pending.operationId,
              config.cartTtlSeconds,
              { requireExpiredLease: true }
            );
            if (restored && (restored.status === 'CONFLICT' || restored.status === 'ACTIVE')) {
              throw new CartBusyError();
            }
          }
        }
      }

      // 3. Generar operationId y orderId para el nuevo snapshot
      const operationId = randomUUID();
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      markOperationInFlight(operationId);
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let leaseLost = false;

      try {
        let reservedItems: CartItemDTO[];

        if (hasReservationPort) {
          const reserveResult = await reservationRepo.reserveCart(
            input.tenantId,
            input.sessionId,
            operationId,
            orderId,
            config.cartTtlSeconds
          );

          if (reserveResult.status === 'EXISTING_RESERVATION') {
            throw new CartBusyError();
          }
          if (reserveResult.status === 'EMPTY') {
            throw new CartEmptyError();
          }
          reservedItems = reserveResult.reservation.items;

          if (typeof reservationRepo.refreshReservationLease === 'function') {
            const leaseTtlMs =
              typeof reservationRepo.leaseTtlMs === 'number' ? reservationRepo.leaseTtlMs : 30000;
            const heartbeatIntervalMs = Math.max(50, Math.floor(leaseTtlMs / 3));
            heartbeatTimer = setInterval(() => {
              reservationRepo
                .refreshReservationLease(input.tenantId, input.sessionId, operationId)
                .then((ok: boolean) => {
                  if (!ok) {
                    leaseLost = true;
                  }
                })
                .catch(() => {
                  leaseLost = true;
                });
            }, heartbeatIntervalMs);
            if (heartbeatTimer.unref) {
              heartbeatTimer.unref();
            }
          }
        } else {
          const cart = this.cartRepo.takeSnapshot
            ? await this.cartRepo.takeSnapshot(input.tenantId, input.sessionId)
            : await this.cartRepo.get(input.tenantId, input.sessionId, config.cartTtlSeconds);

          if (!cart.items || cart.items.length === 0) {
            throw new CartEmptyError();
          }
          reservedItems = cart.items;
        }

        // Operaciones de catálogo y validación de precios FUERA del advisory lock
        const productIds = Array.from(new Set(reservedItems.map((i) => i.productId)));
        const validatedProducts = await this.catalogValidation.getOrderableProducts(
          input.tenantId,
          productIds
        );

        const priced = validateAndPriceCart(reservedItems, validatedProducts);

        if (leaseLost) {
          throw new CartBusyError(input.sessionId);
        }

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

        // Persistencia atómica protegida por pg_advisory_xact_lock (SOLO Postgres dentro del lock)
        let persisted = false;
        let savedOrder: OrderDTO;

        try {
          const persistOrderWork = async (tx?: any): Promise<OrderDTO> => {
            if (this.paymentRepo) {
              const payment = await (this.paymentRepo as any).findBySession(
                input.tenantId,
                input.sessionId,
                tx
              );
              if (payment) {
                throw new SessionNotActiveError('La sesión ya ha sido pagada');
              }
            }

            // Fencing transaccional en Postgres dentro del lock (cero I/O externo)
            if (hasReservationPort) {
              const fenceRepo = this.orderRepo as any;
              if (typeof fenceRepo.claimReservationFence === 'function') {
                const fenceStatus = await fenceRepo.claimReservationFence(
                  input.tenantId,
                  input.sessionId,
                  operationId,
                  orderId,
                  tx
                );
                if (fenceStatus !== 'COMMITTED') {
                  leaseLost = true;
                  throw new CartBusyError(input.sessionId);
                }
              }
            }

            return (this.orderRepo as any).save(input.tenantId, order, tx);
          };

          savedOrder = this.txCoordinator
            ? await this.txCoordinator.runInSessionLock(
                input.tenantId,
                input.sessionId,
                persistOrderWork
              )
            : await persistOrderWork();

          persisted = true;
        } catch (err) {
          if (!persisted && hasReservationPort && !leaseLost) {
            try {
              if (typeof reservationRepo.releaseReservationLease === 'function') {
                await reservationRepo.releaseReservationLease(
                  input.tenantId,
                  input.sessionId,
                  operationId
                );
              }
              await reservationRepo.restoreReservation(
                input.tenantId,
                input.sessionId,
                operationId,
                config.cartTtlSeconds
              );
            } catch {
              // Silently ignore secondary restore failure
            }
          } else if (!persisted && !hasReservationPort) {
            if (this.cartRepo.takeSnapshot && this.cartRepo.restoreCart) {
              await this.cartRepo
                .restoreCart(input.tenantId, input.sessionId, { tenantId: input.tenantId, sessionId: input.sessionId, items: reservedItems, total: 0 }, config.cartTtlSeconds)
                .catch(() => {});
            }
          }
          throw err;
        }

        // Limpiar reserva y emitir eventos solo TRAS el commit exitoso
        if (hasReservationPort) {
          await reservationRepo.ackReservation(input.tenantId, input.sessionId, operationId);
        } else {
          await this.cartRepo.clear(input.tenantId, input.sessionId);
        }

        if (this.eventPublisher) {
          await this.eventPublisher.publishOrderEvent(input.tenantId, {
            type: 'order.created',
            order: savedOrder,
            occurredAt: new Date().toISOString(),
          });
        }

        return savedOrder;
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (!leaseLost && hasReservationPort && typeof reservationRepo.releaseReservationLease === 'function') {
          await reservationRepo
            .releaseReservationLease(input.tenantId, input.sessionId, operationId)
            .catch(() => {});
        }
        markOperationFinished(operationId);
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
      const isStaff = hasRole(role, ORDER_HISTORY_ROLES);
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
