import {
  CartRepository,
  ConfirmCheckoutUseCase,
  EventPublisher,
  GetBillUseCase,
  OrderRepository,
  PaymentRepository,
  ServiceCallRepository,
  SessionServicePort,
} from '@packages/shared-types';
import { GetBill } from './GetBill';
import { ConfirmCheckout } from './ConfirmCheckout';
import { TransactionCoordinator } from './ports/TransactionCoordinator';

export class CheckoutUseCases {
  public readonly getBill: GetBillUseCase;
  public readonly confirmCheckout: ConfirmCheckoutUseCase;

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly sessionService: SessionServicePort,
    private readonly cartRepo: CartRepository,
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher,
    private readonly txCoordinator?: TransactionCoordinator
  ) {
    this.getBill = new GetBill(this.orderRepo, this.paymentRepo);
    this.confirmCheckout = new ConfirmCheckout(
      this.orderRepo,
      this.paymentRepo,
      this.sessionService,
      this.cartRepo,
      this.serviceCallRepo,
      this.eventPublisher,
      this.txCoordinator
    );
  }
}
