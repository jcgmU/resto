import { randomUUID } from 'crypto';
import {
  CancelOrderUseCase,
  CatalogValidationPort,
  CartDTO,
  CartItemDTO,
  CartRepository,
  ConfirmOrderUseCase,
  EventPublisher,
  GetOrderUseCase,
  ListSessionOrdersUseCase,
  ListTenantOrdersUseCase,
  OrderDTO,
  OrderRepository,
  OrderStatus,
  PaymentRepository,
  UpdateOrderStatusUseCase,
} from '@packages/shared-types';
import {
  CartBusyError,
  CartEmptyError,
  ForbiddenError,
  OrderNotFoundError,
  InvalidStatusTransitionError,
  SessionNotActiveError,
} from '../domain/errors';
import { canTransition } from '../domain/orderStatusMachine';
import { validateAndPriceCart } from '../domain/pricing';
import { assertSessionActive, OrderingSessionPort } from '../domain/sessionValidation';
import { TransactionCoordinator } from './ports/TransactionCoordinator';
import { config } from '../config';
import {
  isOperationInFlight,
  markOperationInFlight,
  markOperationFinished,
} from './ports/CartReservationPort';

export class OrderUseCases {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly cartRepo: CartRepository,
    private readonly catalogValidation: CatalogValidationPort,
    private readonly eventPublisher?: EventPublisher,
    private readonly paymentRepo?: PaymentRepository,
    private readonly sessionService?: OrderingSessionPort,
    private readonly txCoordinator?: TransactionCoordinator
  ) {}

  updateOrderStatus = {
    execute: async (input: {
      tenantId: string;
      orderId: string;
      status: OrderStatus;
      requesterRole?: string;
    }): Promise<OrderDTO> => {
      if (input.status === 'CANCELLED' && input.requesterRole && input.requesterRole.toLowerCase() === 'staff') {
        throw new ForbiddenError('Solo personal administrativo puede cancelar órdenes');
      }

      const order = await this.orderRepo.findById(input.tenantId, input.orderId);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (!canTransition(order.status, input.status)) {
        throw new InvalidStatusTransitionError();
      }

      let updated: OrderDTO;
      if (input.status === 'CANCELLED') {
        updated = await this.orderRepo.cancel(input.tenantId, input.orderId, new Date());
      } else {
        updated = await this.orderRepo.updateStatus(
          input.tenantId,
          input.orderId,
          input.status,
          new Date()
        );
      }

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
      // 1. Validar sesión activa y pertenencia tenant/table
      await assertSessionActive(input.tenantId, input.sessionId, {
        tableId: input.tableId,
        paymentRepo: this.paymentRepo,
        sessionService: this.sessionService,
        strictTransport: true,
      });

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

          // Recuperación determinista con Fencing Transaccional en Postgres
          // NOTA X3: DENTRO de runInSessionLock se ejecuta ÚNICAMENTE Postgres (findById + abortReservationFence)
          // Las llamadas de Redis (ackReservation / restoreReservation) se hacen FUERA del lock.
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
          const cart = await this.cartRepo.get(
            input.tenantId,
            input.sessionId,
            config.cartTtlSeconds
          );
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

        const order: OrderDTO = {
          id: orderId,
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          tableId: input.tableId,
          status: 'PLACED',
          total: priced.total,
          items: priced.items,
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
