import { CheckoutUseCases } from '../../src/application/CheckoutUseCases';
import {
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemorySessionServiceAdapter,
  InMemoryCartRepository,
  InMemoryServiceCallRepository,
  InMemoryEventPublisher,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { OrderDTO } from '@packages/shared-types';
import { OrdersNotDeliveredError, ForbiddenError } from '../../src/domain/errors';

describe('Unit - ConfirmCheckout con órdenes sin entregar (ADR D2)', () => {
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let sessionService: InMemorySessionServiceAdapter;
  let cartRepo: InMemoryCartRepository;
  let serviceCallRepo: InMemoryServiceCallRepository;
  let eventPublisher: InMemoryEventPublisher;
  let checkoutUseCases: CheckoutUseCases;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    sessionService = new InMemorySessionServiceAdapter();
    cartRepo = new InMemoryCartRepository();
    serviceCallRepo = new InMemoryServiceCallRepository();
    eventPublisher = new InMemoryEventPublisher();

    checkoutUseCases = new CheckoutUseCases(
      orderRepo,
      paymentRepo,
      sessionService,
      cartRepo,
      serviceCallRepo,
      eventPublisher
    );
  });

  test('(a) PLACED sin flag -> 409 ORDERS_NOT_DELIVERED con details.pendingOrders correcto y sin pago creado', async () => {
    const o: OrderDTO = {
      id: 'ord-placed-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      kitchenStatus: 'PLACED',
      total: 30,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Pizza',
          unitPrice: 15,
          quantity: 2,
          modifiers: [],
        },
      ],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    let thrownError: any = null;
    try {
      await checkoutUseCases.confirmCheckout.execute({
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        method: 'CASH',
        recordedBy: 'staff-1',
        role: 'admin',
      });
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(OrdersNotDeliveredError);
    expect(thrownError.code).toBe('ORDERS_NOT_DELIVERED');
    expect(thrownError.details).toBeDefined();
    expect(thrownError.details.pendingOrders).toHaveLength(1);
    expect(thrownError.details.pendingOrders[0]).toEqual({
      orderId: 'ord-placed-1',
      tableId: 'tb-1',
      status: 'PLACED',
      kitchenStatus: 'PLACED',
      barStatus: null,
      createdAt: '2026-11-09T15:00:00.000Z',
      itemsCount: 2,
    });

    // Sin pago creado
    expect(paymentRepo.payments).toHaveLength(0);
  });

  test('(b) READY + closePendingOrders: true + manager -> 201 y orden queda en CANCELLED con cancelReason checkout y kitchenStatus CANCELLED', async () => {
    const o: OrderDTO = {
      id: 'ord-ready-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'READY',
      kitchenStatus: 'READY',
      total: 40,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Burger',
          unitPrice: 40,
          quantity: 1,
          modifiers: [],
        },
      ],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    const result = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'mgr-1',
      role: 'manager',
      closePendingOrders: true,
    });

    expect(result.payment).toBeDefined();
    expect(result.payment.amount).toBe(40);

    const savedOrder = await orderRepo.findById('t-1', 'ord-ready-1');
    expect(savedOrder?.status).toBe('CANCELLED');
    expect(savedOrder?.cancelReason).toBe('checkout');
    expect(savedOrder?.kitchenStatus).toBe('CANCELLED');
  });

  test('(c) closePendingOrders: true + cashier -> 403 FORBIDDEN y nada cambia (sin pago ni orden cancelada)', async () => {
    const o: OrderDTO = {
      id: 'ord-c-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'IN_KITCHEN',
      kitchenStatus: 'IN_KITCHEN',
      total: 25,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Tacos', unitPrice: 25, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    let thrownError: any = null;
    try {
      await checkoutUseCases.confirmCheckout.execute({
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        method: 'CASH',
        recordedBy: 'caja-1',
        role: 'cashier',
        closePendingOrders: true,
      });
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ForbiddenError);
    expect(thrownError.code).toBe('FORBIDDEN');
    expect(paymentRepo.payments).toHaveLength(0);

    const orderAfter = await orderRepo.findById('t-1', 'ord-c-1');
    expect(orderAfter?.status).toBe('IN_KITCHEN');
  });

  test('(d) closePendingOrders: true + staff -> 403 FORBIDDEN', async () => {
    const o: OrderDTO = {
      id: 'ord-d-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 10,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Soda', unitPrice: 10, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    await expect(
      checkoutUseCases.confirmCheckout.execute({
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        method: 'CASH',
        recordedBy: 'staff-1',
        role: 'staff',
        closePendingOrders: true,
      })
    ).rejects.toThrow(ForbiddenError);

    expect(paymentRepo.payments).toHaveLength(0);
  });

  test('(e) Todo DELIVERED -> 201 sin flag', async () => {
    const o: OrderDTO = {
      id: 'ord-e-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'DELIVERED',
      kitchenStatus: 'DELIVERED',
      total: 50,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Steak', unitPrice: 50, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    const res = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CARD',
      recordedBy: 'staff-1',
      role: 'staff',
    });

    expect(res.payment.amount).toBe(50);
    expect(paymentRepo.payments).toHaveLength(1);
  });

  test('(f) Reintento con pago existente -> 200 con el mismo total (no re-evalúa 409)', async () => {
    const o: OrderDTO = {
      id: 'ord-f-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'DELIVERED',
      total: 30,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Salad', unitPrice: 30, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    const first = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'staff-1',
      role: 'staff',
    });

    const second = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'staff-1',
      role: 'staff',
    });

    expect((second as any).isExisting).toBe(true);
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.payment.amount).toBe(30);
  });

  test('(g) GetBill después del cierre con closePendingOrders: true = monto del pago', async () => {
    const o: OrderDTO = {
      id: 'ord-g-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'READY',
      total: 75,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Ribs', unitPrice: 75, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    const checkoutRes = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CARD',
      recordedBy: 'admin-1',
      role: 'admin',
      closePendingOrders: true,
    });

    const bill = await checkoutUseCases.getBill.execute({
      tenantId: 't-1',
      sessionId: 's-1',
    });

    expect(bill.total).toBe(checkoutRes.payment.amount);
    expect(bill.ordersCount).toBe(1);
    expect(bill.orders[0].id).toBe('ord-g-1');
  });

  test('(h) Order history incluye el evento con reason: checkout', async () => {
    const o: OrderDTO = {
      id: 'ord-h-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 12,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Drink', unitPrice: 12, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'mgr-1',
      role: 'manager',
      closePendingOrders: true,
    });

    const history = await orderRepo.getOrderHistory('t-1', 'ord-h-1');
    const cancelEvt = history.find((e) => e.toStatus === 'CANCELLED');
    expect(cancelEvt).toBeDefined();
    expect(cancelEvt?.reason).toBe('checkout');
  });

  test('(i) Se publica un evento order.status-changed por cada orden cerrada', async () => {
    const o: OrderDTO = {
      id: 'ord-i-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'IN_KITCHEN',
      kitchenStatus: 'IN_KITCHEN',
      total: 28,
      items: [{ id: 'it-1', productId: 'p1', productName: 'Pasta', unitPrice: 28, quantity: 1, modifiers: [] }],
      createdAt: '2026-11-09T15:00:00.000Z',
    };
    await orderRepo.save('t-1', o);

    await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'admin-1',
      role: 'admin',
      closePendingOrders: true,
    });

    const changedEvents = eventPublisher.orderEvents.filter(
      (e) => e.event.type === 'order.status-changed' && e.event.order.id === 'ord-i-1'
    );
    expect(changedEvents).toHaveLength(1);
    expect(changedEvents[0].event.order.status).toBe('CANCELLED');
    expect(changedEvents[0].event.previousStatus).toBe('IN_KITCHEN');
    expect(changedEvents[0].event.order.cancelReason).toBe('checkout');
    expect(changedEvents[0].event.order.kitchenStatus).toBe('CANCELLED');
  });
});
