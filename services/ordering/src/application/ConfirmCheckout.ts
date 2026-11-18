import { randomUUID } from 'crypto';
import {
  BillDTO,
  CartRepository,
  ConfirmCheckoutUseCase,
  EventPublisher,
  OrderDTO,
  OrderRepository,
  PaymentDTO,
  PaymentMethod,
  PaymentRepository,
  PendingOrderSummaryDTO,
  ServiceCallRepository,
  SessionServicePort,
  InvoiceProvider,
} from '@packages/shared-types';
import { calculateBill } from '../domain/bill';
import { validatePaymentMethod } from '../domain/payment';
import {
  BillEmptyError,
  CartBusyError,
  ForbiddenError,
  OrdersNotDeliveredError,
  SessionCloseFailedError,
} from '../domain/errors';
import { guardCheckoutSession } from './sessionGuard';
import { OrderingSessionPort } from '../domain/sessionValidation';
import { TransactionCoordinator } from './ports/TransactionCoordinator';
import { isOperationInFlight } from './ports/CartReservationPort';
import { config } from '../config';
import { CHECKOUT_OVERRIDE_PENDING_ROLES, hasRole } from '../interfaces/http/authzRoles';

export interface ConfirmCheckoutResult {
  bill: BillDTO;
  payment: PaymentDTO;
  isExisting?: boolean;
}

export class ConfirmCheckout implements ConfirmCheckoutUseCase {
  private localCompletedCheckouts = new Set<string>();
  private readonly invoiceProvider?: InvoiceProvider;
  private readonly txCoordinator?: TransactionCoordinator;

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort | OrderingSessionPort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher,
    arg7?: InvoiceProvider | TransactionCoordinator,
    arg8?: TransactionCoordinator | InvoiceProvider
  ) {
    if (arg7) {
      if ('issue' in arg7) {
        this.invoiceProvider = arg7 as InvoiceProvider;
      } else if ('runInSessionLock' in arg7) {
        this.txCoordinator = arg7 as TransactionCoordinator;
      }
    }
    if (arg8) {
      if ('runInSessionLock' in arg8) {
        this.txCoordinator = arg8 as TransactionCoordinator;
      } else if ('issue' in arg8) {
        this.invoiceProvider = arg8 as InvoiceProvider;
      }
    }
  }

  async execute(input: {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    method: PaymentMethod;
    recordedBy: string;
    role?: string;
    closePendingOrders?: boolean;
    invoiceMode?: 'simple' | 'dian';
    invoiceCustomer?: {
      type?: 'final_consumer' | 'business';
      taxId?: string;
      legalName?: string;
      email?: string;
    };
  }): Promise<ConfirmCheckoutResult> {
    const { tenantId, sessionId, tableId, recordedBy } = input;
    const method = validatePaymentMethod(input.method);

    // 1. Idempotencia y Retry: Verificar primero si ya existe Payment para (tenantId, sessionId)
    const existingPayment = await this.paymentRepo.findBySession(tenantId, sessionId);

    // Validar sesión y derivar mesa efectiva
    const { effectiveTableId } = await guardCheckoutSession({
      sessionService: this.sessionService as any,
      tenantId,
      sessionId,
      inputTableId: tableId,
      hasExistingPayment: Boolean(existingPayment),
    });

    let payment: PaymentDTO;
    let isExisting = false;
    let cancelledOrders: OrderDTO[] = [];
    const prevStatusMap = new Map<string, string>();

    if (existingPayment) {
      payment = existingPayment;
      isExisting = true;
    } else {
      // 2b. Recuperar reservas huérfanas de carrito antes de avanzar con el cobro
      if (
        'findReservation' in this.cartRepo &&
        typeof (this.cartRepo as any).findReservation === 'function'
      ) {
        const reservationRepo = this.cartRepo as any;
        const pending = await reservationRepo.findReservation(tenantId, sessionId);
        if (pending) {
          const isLeaseActive =
            typeof reservationRepo.isReservationLeaseActive === 'function'
              ? await reservationRepo.isReservationLeaseActive(tenantId, sessionId, pending.operationId)
              : isOperationInFlight(pending.operationId);

          if (!isLeaseActive) {
            const recoverWork = async (
              tx?: any
            ): Promise<{ action: 'ACK' | 'RESTORE' | 'NONE'; operationId?: string }> => {
              const currentPending = await reservationRepo.findReservation(tenantId, sessionId);
              if (!currentPending || currentPending.operationId !== pending.operationId) {
                return { action: 'NONE' };
              }
              if (typeof reservationRepo.isReservationLeaseActive === 'function') {
                const stillActive = await reservationRepo.isReservationLeaseActive(
                  tenantId,
                  sessionId,
                  currentPending.operationId
                );
                if (stillActive) return { action: 'NONE' };
              }

              const fenceRepo = this.orderRepo as any;
              let fenceStatus: 'COMMITTED' | 'ABORTED' = 'ABORTED';
              if (fenceRepo && typeof fenceRepo.abortReservationFence === 'function') {
                fenceStatus = await fenceRepo.abortReservationFence(
                  tenantId,
                  sessionId,
                  currentPending.operationId,
                  currentPending.orderId,
                  tx
                );
              } else if (this.orderRepo) {
                const existingOrder = await (this.orderRepo as any).findById(
                  tenantId,
                  currentPending.orderId,
                  tx
                );
                if (existingOrder) {
                  fenceStatus = 'COMMITTED';
                }
              }

              if (fenceStatus === 'COMMITTED') {
                return { action: 'ACK', operationId: currentPending.operationId };
              }

              return { action: 'RESTORE', operationId: currentPending.operationId };
            };

            const decision = this.txCoordinator
              ? await this.txCoordinator.runInSessionLock(tenantId, sessionId, recoverWork)
              : await recoverWork();

            if (decision?.action === 'ACK' && decision.operationId) {
              await reservationRepo.ackReservation(tenantId, sessionId, decision.operationId);
            } else if (decision?.action === 'RESTORE' && decision.operationId) {
              const restored = await reservationRepo.restoreReservation(
                tenantId,
                sessionId,
                decision.operationId,
                config.cartTtlSeconds,
                { requireExpiredLease: true }
              );
              if (restored && (restored.status === 'CONFLICT' || restored.status === 'ACTIVE')) {
                throw new CartBusyError();
              }
            }
          }
        }
      }

      // 3. Coordinación transaccional local con pg_advisory_xact_lock
      const checkoutWork = async (
        tx?: any
      ): Promise<{ payment: PaymentDTO; isExisting: boolean; cancelledOrders: OrderDTO[] }> => {
        // Doble verificación dentro de la transacción protegida por lock
        const inTxPayment = await (this.paymentRepo as any).findBySession(
          tenantId,
          sessionId,
          tx
        );
        if (inTxPayment) {
          return { payment: inTxPayment, isExisting: true, cancelledOrders: [] };
        }

        // Calcular la cuenta leyendo las órdenes dentro de la misma transacción
        const orders = await (this.orderRepo as any).listBySession(tenantId, sessionId, tx);
        const calculated = calculateBill(orders);

        if (calculated.orders.length === 0) {
          throw new BillEmptyError(
            'BILL_EMPTY: No hay órdenes activas para cobrar en esta sesión'
          );
        }

        // Validación de órdenes sin entregar (solo en cobros nuevos, no en reintentos con pago existente)
        const pending = orders.filter((o: OrderDTO) =>
          ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
        );
        pending.forEach((o: OrderDTO) => prevStatusMap.set(o.id, o.status));

        let txCancelledOrders: OrderDTO[] = [];
        if (pending.length > 0) {
          if (!input.closePendingOrders) {
            const pendingSummaries: PendingOrderSummaryDTO[] = pending.map((o: OrderDTO) => ({
              orderId: o.id,
              tableId: o.tableId,
              status: o.status,
              kitchenStatus: (o.kitchenStatus as any) ?? null,
              barStatus: (o.barStatus as any) ?? null,
              createdAt: o.createdAt,
              itemsCount: (o.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
            }));
            throw new OrdersNotDeliveredError(pendingSummaries);
          }

          if (!hasRole(input.role, CHECKOUT_OVERRIDE_PENDING_ROLES)) {
            throw new ForbiddenError(
              'Solo personal con rol admin o manager puede cerrar pedidos pendientes al cobrar'
            );
          }

          const now = new Date();
          const pendingIds = pending.map((o: OrderDTO) => o.id);
          if (typeof (this.orderRepo as any).cancelForCheckout === 'function') {
            txCancelledOrders = await (this.orderRepo as any).cancelForCheckout(
              tenantId,
              pendingIds,
              now,
              tx
            );
          }
        }

        let invoiceStatus: any = 'none';
        let invoiceRef: string | undefined;
        let invoiceError: string | undefined;

        const paymentId = randomUUID();

        if (this.invoiceProvider && (input.invoiceMode === 'dian' || input.invoiceCustomer)) {
          try {
            const itemsPayload = calculated.orders.flatMap((o) =>
              o.items.map((i) => ({
                name: i.productName,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.unitPrice * i.quantity,
              }))
            );

            const invoiceRes = await this.invoiceProvider.issue({
              tenantId,
              paymentId,
              amount: calculated.total,
              customer: input.invoiceCustomer,
              items: itemsPayload,
            });

            invoiceStatus = invoiceRes.status;
            invoiceRef = invoiceRes.ref;
            invoiceError = invoiceRes.error;
          } catch (invoiceErr: any) {
            invoiceStatus = 'error';
            invoiceError = invoiceErr?.message || 'Error al emitir factura DIAN';
          }
        }

        const paymentToSave: PaymentDTO = {
          id: paymentId,
          tenantId,
          sessionId,
          tableId: effectiveTableId,
          amount: calculated.total, // CRITICAL: Server-calculated amount ONLY
          method,
          ordersCount: calculated.ordersCount,
          recordedBy,
          createdAt: new Date().toISOString(),
          invoiceStatus,
          invoiceRef,
          invoiceError,
        };

        const saved = await (this.paymentRepo as any).save(tenantId, paymentToSave, tx);
        return { payment: saved, isExisting: false, cancelledOrders: txCancelledOrders };
      };

      const result = this.txCoordinator
        ? await this.txCoordinator.runInSessionLock(tenantId, sessionId, checkoutWork)
        : await checkoutWork();

      payment = result.payment;
      isExisting = result.isExisting;
      cancelledOrders = result.cancelledOrders;
    }

    // 4. Por cada orden en pending cancelada: publicar evento order.status-changed
    if (this.eventPublisher && !isExisting && cancelledOrders.length > 0) {
      const now = new Date();
      for (const p of cancelledOrders) {
        await this.eventPublisher.publishOrderEvent(tenantId, {
          type: 'order.status-changed',
          order: p,
          previousStatus: (prevStatusMap.get(p.id) as any) || 'PLACED',
          occurredAt: now.toISOString(),
        });
      }
    }

    // 5. Orquestación: closeSession DESPUÉS de persistir el pago en BD localmente
    // IMPORTANTE: NO mantener el transaction lock abierto durante la llamada HTTP externa.
    try {
      await this.sessionService.closeSession(tenantId, sessionId, {
        userId: recordedBy,
        role: 'cashier',
      });
    } catch (err) {
      throw new SessionCloseFailedError(
        'SESSION_CLOSE_FAILED: Error al cerrar sesión en session service'
      );
    }

    // 6. Limpieza de residuos propios (solo claves de ordering, redis db1)
    const cleanupCart = async () => {
      if ('clearAll' in this.cartRepo && typeof (this.cartRepo as any).clearAll === 'function') {
        await (this.cartRepo as any).clearAll(tenantId, sessionId);
      } else {
        await this.cartRepo.clear(tenantId, sessionId);
      }
    };

    if (this.txCoordinator) {
      await this.txCoordinator.runInSessionLock(tenantId, sessionId, cleanupCart);
    } else {
      await cleanupCart();
    }

    try {
      const pendingCalls = await this.serviceCallRepo.listByTenant(tenantId, { status: 'pending' });
      const sessionCalls = pendingCalls.filter((c) => c.sessionId === sessionId);
      const resolveNow = new Date();
      for (const call of sessionCalls) {
        await this.serviceCallRepo.resolve(tenantId, call.callId, resolveNow);
      }
    } catch {
      // Ignorar fallo secundario de limpieza de service calls
    }

    // 7. Publicar evento session.checkout-completed con outbox duradero y deduplicación determinista
    const eventId = `checkout-completed:${tenantId}:${sessionId}:${payment.id}`;
    const eventPayload = {
      eventId,
      type: 'session.checkout-completed' as const,
      tenantId,
      sessionId,
      tableId: effectiveTableId,
      payment,
      paymentId: payment.id,
      total: payment.amount,
      method: payment.method,
      paidAt: payment.createdAt || new Date().toISOString(),
      occurredAt: new Date().toISOString(),
    };

    let isAlreadyPublished = false;

    if (
      'isCheckoutEventPublished' in this.cartRepo &&
      typeof (this.cartRepo as any).isCheckoutEventPublished === 'function'
    ) {
      if (
        'ensureCheckoutOutboxPending' in this.cartRepo &&
        typeof (this.cartRepo as any).ensureCheckoutOutboxPending === 'function'
      ) {
        await (this.cartRepo as any).ensureCheckoutOutboxPending(tenantId, sessionId, eventPayload);
      }
      isAlreadyPublished = await (this.cartRepo as any).isCheckoutEventPublished(tenantId, sessionId);
    } else {
      const key = `${tenantId}:${sessionId}`;
      isAlreadyPublished = this.localCompletedCheckouts.has(key);
    }

    if (this.eventPublisher && !isAlreadyPublished) {
      await this.eventPublisher.publishCheckoutCompleted(tenantId, eventPayload as any);

      if (
        'markCheckoutCompleted' in this.cartRepo &&
        typeof (this.cartRepo as any).markCheckoutCompleted === 'function'
      ) {
        await (this.cartRepo as any).markCheckoutCompleted(tenantId, sessionId);
      } else {
        const key = `${tenantId}:${sessionId}`;
        this.localCompletedCheckouts.add(key);
      }
    }

    const currentOrders = await this.orderRepo.listBySession(tenantId, sessionId);
    const calculatedFinal = calculateBill(currentOrders);

    const bill: BillDTO = {
      sessionId,
      tableId: effectiveTableId,
      orders: calculatedFinal.orders,
      ordersCount: calculatedFinal.ordersCount,
      total: payment.amount,
      payment,
    };

    return { bill, payment, isExisting };
  }
}
