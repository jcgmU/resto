import {
  CartRepository,
  ConfirmCheckoutUseCase,
  EventPublisher,
  GetBillUseCase,
  OrderRepository,
  PaymentRepository,
  ServiceCallRepository,
  SessionServicePort,
  InvoiceProvider,
  PaymentDTO,
} from '@packages/shared-types';
import { GetBill } from './GetBill';
import { ConfirmCheckout } from './ConfirmCheckout';

export class CheckoutUseCases {
  public readonly getBill: GetBillUseCase;
  public readonly confirmCheckout: ConfirmCheckoutUseCase;
  public readonly retryInvoice?: {
    execute: (input: { tenantId: string; sessionId: string; customer?: any }) => Promise<PaymentDTO>;
  };

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher,
    private readonly invoiceProvider?: InvoiceProvider
  ) {
    this.getBill = new GetBill(this.orderRepo, this.paymentRepo);
    this.confirmCheckout = new ConfirmCheckout(
      this.orderRepo,
      this.paymentRepo,
      this.sessionService,
      this.cartRepo,
      this.serviceCallRepo,
      this.eventPublisher,
      this.invoiceProvider
    );

    if (this.invoiceProvider) {
      this.retryInvoice = {
        execute: async (input: { tenantId: string; sessionId: string; customer?: any }) => {
          const payment = await this.paymentRepo.findBySession(input.tenantId, input.sessionId);
          if (!payment) {
            throw new Error(`No existe pago registrado para la sesión ${input.sessionId}`);
          }

          const orders = await this.orderRepo.listBySession(input.tenantId, input.sessionId);
          const itemsPayload = orders.flatMap((o) =>
            o.items.map((i) => ({
              name: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.unitPrice * i.quantity,
            }))
          );

          try {
            const invoiceRes = await this.invoiceProvider!.issue({
              tenantId: input.tenantId,
              paymentId: payment.id,
              amount: payment.amount,
              customer: input.customer,
              items: itemsPayload,
            });

            payment.invoiceStatus = invoiceRes.status;
            payment.invoiceRef = invoiceRes.ref;
            payment.invoiceError = invoiceRes.error;
          } catch (err: any) {
            payment.invoiceStatus = 'error';
            payment.invoiceError = err?.message || 'Error en reintento de emisión';
          }

          return this.paymentRepo.save(input.tenantId, payment);
        },
      };
    }
  }
}
