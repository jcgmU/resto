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
import { BillEmptyError, SessionCloseFailedError } from '../domain/errors';
import { guardCheckoutSession } from './sessionGuard';

export interface ConfirmCheckoutResult {
  bill: BillDTO;
  payment: PaymentDTO;
  isExisting?: boolean;
}

export class ConfirmCheckout implements ConfirmCheckoutUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async execute(input: {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    method: PaymentMethod;
    recordedBy: string;
  }): Promise<ConfirmCheckoutResult> {
    const { tenantId, sessionId, tableId, recordedBy } = input;
    const method = validatePaymentMethod(input.method);

    // Idempotencia: Verificar si ya existe Payment para (tenantId, sessionId)
    const existingPayment = await this.paymentRepo.findBySession(tenantId, sessionId);

    // Validar sesión y derivar mesa efectiva
    const { effectiveTableId } = await guardCheckoutSession({
      sessionService: this.sessionService,
      tenantId,
      sessionId,
      inputTableId: tableId,
      hasExistingPayment: Boolean(existingPayment),
    });

    // 1. Calcular la cuenta: OrderRepository.listBySession filtrando status != CANCELLED
    const orders = await this.orderRepo.listBySession(tenantId, sessionId);
    const calculated = calculateBill(orders);

    if (!existingPayment && calculated.orders.length === 0) {
      throw new BillEmptyError('BILL_EMPTY: No hay órdenes activas para cobrar en esta sesión');
    }

    // 2. Persistir Payment con amount = total calculado en servidor (el body NUNCA trae monto)
    let payment: PaymentDTO;
    let isExisting = false;

    if (existingPayment) {
      payment = existingPayment;
      isExisting = true;
    } else {
      const paymentToSave: PaymentDTO = {
        id: randomUUID(),
        tenantId,
        sessionId,
        tableId: effectiveTableId,
        amount: calculated.total, // CRITICAL: Server-calculated amount ONLY
        method,
        ordersCount: calculated.ordersCount,
        recordedBy,
        createdAt: new Date().toISOString(),
      };

      try {
        payment = await this.paymentRepo.save(tenantId, paymentToSave);
      } catch (err: any) {
        // La unique constraint @@unique([tenantId, sessionId]) es la fuente de idempotencia
        if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
          const found = await this.paymentRepo.findBySession(tenantId, sessionId);
          if (found) {
            payment = found;
            isExisting = true;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // 3. Orquestación: closeSession DESPUÉS de persistir el pago, propagando identidad
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

    // 4. Limpieza de residuos propios (solo claves de ordering, redis db1)
    await this.cartRepo.clear(tenantId, sessionId);

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

    // 5. Publicar evento session.checkout-completed tras la orquestación y limpieza (solo si es pago nuevo)
    if (this.eventPublisher && !isExisting) {
      await this.eventPublisher.publishCheckoutCompleted(tenantId, {
        type: 'session.checkout-completed',
        sessionId,
        tableId: effectiveTableId,
        payment,
        occurredAt: new Date().toISOString(),
      });
    }

    const bill: BillDTO = {
      sessionId,
      tableId: effectiveTableId,
      orders: calculated.orders,
      ordersCount: calculated.ordersCount,
      total: payment.amount,
      payment,
    };

    return { bill, payment, isExisting };
  }
}
