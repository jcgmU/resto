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
import { BillEmptyError, ForbiddenError, OrdersNotDeliveredError, SessionCloseFailedError } from '../domain/errors';
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
    private readonly eventPublisher?: EventPublisher,
    private readonly invoiceProvider?: InvoiceProvider
  ) {}

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
    const normalizedRole = (input.role || '').toLowerCase();

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

    // Validación de órdenes sin entregar (solo en cobros nuevos, no en reintentos con pago existente)
    const pending = !existingPayment
      ? orders.filter((o) => ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status))
      : [];

    if (!existingPayment && pending.length > 0) {
      if (!input.closePendingOrders) {
        const pendingSummaries: PendingOrderSummaryDTO[] = pending.map((o) => ({
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

      if (normalizedRole !== 'admin' && normalizedRole !== 'manager') {
        throw new ForbiddenError('Solo personal con rol admin o manager puede cerrar pedidos pendientes al cobrar');
      }
    }

    // 2. Persistir Payment con amount = total calculado en servidor (el body NUNCA trae monto)
    let payment: PaymentDTO;
    let isExisting = false;

    if (existingPayment) {
      payment = existingPayment;
      isExisting = true;
    } else {
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

    // 3. Si pending.length > 0: cancelForCheckout(tenantId, pendingIds, now)
    const now = new Date();
    let cancelledOrders: OrderDTO[] = [];
    if (!isExisting && pending.length > 0) {
      const pendingIds = pending.map((o) => o.id);
      cancelledOrders = await this.orderRepo.cancelForCheckout(tenantId, pendingIds, now);
    }

    // 4. Por cada orden en pending: publicar evento order.status-changed
    if (this.eventPublisher && !isExisting && pending.length > 0) {
      for (const p of pending) {
        const cancelled = cancelledOrders.find((c) => c.id === p.id) || {
          ...p,
          status: 'CANCELLED' as const,
          cancelReason: 'checkout',
          kitchenStatus: p.kitchenStatus ? ('CANCELLED' as const) : undefined,
          barStatus: p.barStatus ? ('CANCELLED' as const) : undefined,
          destinationStatus: {
            ...(p.kitchenStatus ? { kitchen: 'CANCELLED' as const } : {}),
            ...(p.barStatus ? { bar: 'CANCELLED' as const } : {}),
          },
          cancelledAt: now.toISOString(),
        };

        await this.eventPublisher.publishOrderEvent(tenantId, {
          type: 'order.status-changed',
          order: cancelled,
          previousStatus: p.status,
          occurredAt: now.toISOString(),
        });
      }
    }

    // 5. Orquestación: closeSession DESPUÉS de persistir el pago, propagando identidad
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

    // 6. Limpieza de residuos propios (solo claves de ordering, redis db1)
    await this.cartRepo.clear(tenantId, sessionId);

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

    // 7. Publicar evento session.checkout-completed tras la orquestación y limpieza (solo si es pago nuevo)
    if (this.eventPublisher && !isExisting) {
      await this.eventPublisher.publishCheckoutCompleted(tenantId, {
        type: 'session.checkout-completed',
        sessionId,
        tableId: effectiveTableId,
        payment,
        occurredAt: new Date().toISOString(),
      });
    }

    const finalOrders = calculated.orders.map((o) => {
      const cancelled = cancelledOrders.find((c) => c.id === o.id);
      return cancelled || o;
    });

    const bill: BillDTO = {
      sessionId,
      tableId: effectiveTableId,
      orders: finalOrders,
      ordersCount: calculated.ordersCount,
      total: payment.amount,
      payment,
    };

    return { bill, payment, isExisting };
  }
}
