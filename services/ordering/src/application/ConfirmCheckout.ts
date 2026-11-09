import { randomUUID } from 'crypto';
import {
  BillDTO,
  CartRepository,
  ConfirmCheckoutUseCase,
  EventPublisher,
  OrderRepository,
  PaymentDTO,
  PaymentMethod,
  PaymentRepository,
  ServiceCallRepository,
  SessionServicePort,
} from '@packages/shared-types';
import { calculateBill } from '../domain/bill';
import { validatePaymentMethod } from '../domain/payment';
import { BillEmptyError, CartBusyError, SessionCloseFailedError } from '../domain/errors';
import { assertSessionActive, OrderingSessionPort } from '../domain/sessionValidation';
import { TransactionCoordinator } from './ports/TransactionCoordinator';
import { isOperationInFlight } from './ports/CartReservationPort';
import { config } from '../config';

export interface ConfirmCheckoutResult {
  bill: BillDTO;
  payment: PaymentDTO;
  isExisting?: boolean;
}

export class ConfirmCheckout implements ConfirmCheckoutUseCase {
  private localCompletedCheckouts = new Set<string>();

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher,
    private readonly txCoordinator?: TransactionCoordinator
  ) {}

  async execute(input: {
    tenantId: string;
    sessionId: string;
    tableId: string;
    method: PaymentMethod;
    recordedBy: string;
  }): Promise<ConfirmCheckoutResult> {
    const { tenantId, sessionId, tableId, recordedBy } = input;
    const method = validatePaymentMethod(input.method);

    // 1. Idempotencia y Retry: Verificar primero si ya existe Payment para (tenantId, sessionId)
    // En retry ante fallo de closeSession, una sesión ya cerrada es normal: leer el pago antes de exigir sesión activa.
    const existingPayment = await this.paymentRepo.findBySession(tenantId, sessionId);

    let payment: PaymentDTO;
    let isExisting = false;

    if (existingPayment) {
      payment = existingPayment;
      isExisting = true;
    } else {
      // 2. Si no hay pago previo: validar que la sesión esté activa y pertenezca al tenant/table
      await assertSessionActive(tenantId, sessionId, {
        tableId,
        sessionService: this.sessionService as OrderingSessionPort,
      });

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
      ): Promise<{ payment: PaymentDTO; isExisting: boolean }> => {
        // Doble verificación dentro de la transacción protegida por lock
        const inTxPayment = await (this.paymentRepo as any).findBySession(
          tenantId,
          sessionId,
          tx
        );
        if (inTxPayment) {
          return { payment: inTxPayment, isExisting: true };
        }

        // Calcular la cuenta leyendo las órdenes dentro de la misma transacción
        const orders = await (this.orderRepo as any).listBySession(tenantId, sessionId, tx);
        const calculated = calculateBill(orders);

        if (calculated.orders.length === 0) {
          throw new BillEmptyError(
            'BILL_EMPTY: No hay órdenes activas para cobrar en esta sesión'
          );
        }

        const paymentToSave: PaymentDTO = {
          id: randomUUID(),
          tenantId,
          sessionId,
          tableId,
          amount: calculated.total, // CRITICAL: Server-calculated amount ONLY
          method,
          ordersCount: calculated.ordersCount,
          recordedBy,
          createdAt: new Date().toISOString(),
        };

        const saved = await (this.paymentRepo as any).save(tenantId, paymentToSave, tx);
        return { payment: saved, isExisting: false };
      };

      const result = this.txCoordinator
        ? await this.txCoordinator.runInSessionLock(tenantId, sessionId, checkoutWork)
        : await checkoutWork();

      payment = result.payment;
      isExisting = result.isExisting;
    }

    // 4. Orquestación: closeSession DESPUÉS de persistir el pago en BD localmente
    // IMPORTANTE: NO mantener el transaction lock abierto durante la llamada HTTP externa.
    try {
      await this.sessionService.closeSession(tenantId, sessionId, {
        userId: recordedBy,
        role: 'staff',
      });
    } catch (err) {
      throw new SessionCloseFailedError(
        'SESSION_CLOSE_FAILED: Error al cerrar sesión en session service'
      );
    }

    // 5. Limpieza de residuos propios (solo claves de ordering, redis db1)
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
      const now = new Date();
      for (const call of sessionCalls) {
        await this.serviceCallRepo.resolve(tenantId, call.callId, now);
      }
    } catch {
      // Ignorar fallo secundario de limpieza de service calls
    }

    // 6. Publicar evento session.checkout-completed con outbox duradero y deduplicación determinista
    const eventId = `checkout-completed:${tenantId}:${sessionId}:${payment.id}`;
    const eventPayload = {
      eventId,
      type: 'session.checkout-completed' as const,
      tenantId,
      sessionId,
      tableId,
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
      tableId,
      orders: calculatedFinal.orders,
      ordersCount: calculatedFinal.ordersCount,
      total: payment.amount,
      payment,
    };

    return { bill, payment, isExisting };
  }
}
