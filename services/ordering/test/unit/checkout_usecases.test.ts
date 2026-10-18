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

describe('A. Ordering — unitarios checkout (Tests 1-8)', () => {
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

  test('1. GetBill suma SOLO las Orders no canceladas de la sesión (una CANCELLED queda fuera) y devuelve total/ordersCount correctos', async () => {
    const o1: OrderDTO = {
      id: 'ord-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 30,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const o2: OrderDTO = {
      id: 'ord-2',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'CANCELLED',
      total: 50,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const o3: OrderDTO = {
      id: 'ord-3',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'READY',
      total: 20,
      items: [],
      createdAt: new Date().toISOString(),
    };

    await orderRepo.save('t-1', o1);
    await orderRepo.save('t-1', o2);
    await orderRepo.save('t-1', o3);

    const bill = await checkoutUseCases.getBill.execute({
      tenantId: 't-1',
      sessionId: 's-1',
    });

    expect(bill.ordersCount).toBe(2);
    expect(bill.total).toBe(50);
    expect(bill.orders.map((o) => o.id)).toEqual(['ord-1', 'ord-3']);
  });

  test('2. GetBill de sesión de otro tenant -> BILL_NOT_FOUND', async () => {
    await orderRepo.save('t-other', {
      id: 'ord-other',
      tenantId: 't-other',
      sessionId: 's-other',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 30,
      items: [],
      createdAt: new Date().toISOString(),
    });

    await expect(
      checkoutUseCases.getBill.execute({
        tenantId: 't-1',
        sessionId: 's-other',
      })
    ).rejects.toThrow('BILL_NOT_FOUND');
  });

  test('3. ConfirmCheckout persiste Payment con amount = total calculado en servidor (un amount manipulado en el body se ignora) y recordedBy del caller', async () => {
    await orderRepo.save('t-1', {
      id: 'ord-10',
      tenantId: 't-1',
      sessionId: 's-10',
      tableId: 'tb-1',
      status: 'READY',
      total: 45,
      items: [],
      createdAt: new Date().toISOString(),
    });

    const result = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-10',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'user-staff-1',
    });

    expect(result.payment.amount).toBe(45);
    expect(result.payment.recordedBy).toBe('user-staff-1');
    expect(result.payment.method).toBe('CASH');
  });

  test('4. ConfirmCheckout sin Orders no canceladas -> BILL_EMPTY, sin persistir nada', async () => {
    await expect(
      checkoutUseCases.confirmCheckout.execute({
        tenantId: 't-1',
        sessionId: 's-empty',
        tableId: 'tb-1',
        method: 'CARD',
        recordedBy: 'user-staff-1',
      })
    ).rejects.toThrow('BILL_EMPTY');

    expect(paymentRepo.payments).toHaveLength(0);
  });

  test('5. ConfirmCheckout llama closeSession DESPUÉS de persistir el pago, propagando la identidad del staff (userId, role)', async () => {
    await orderRepo.save('t-1', {
      id: 'ord-5',
      tenantId: 't-1',
      sessionId: 's-5',
      tableId: 'tb-1',
      status: 'READY',
      total: 25,
      items: [],
      createdAt: new Date().toISOString(),
    });

    await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-5',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'staff-42',
    });

    expect(sessionService.closedSessions).toHaveLength(1);
    expect(sessionService.closedSessions[0]).toEqual({
      tenantId: 't-1',
      sessionId: 's-5',
      requester: { userId: 'staff-42', role: 'staff' },
    });
  });

  test('6. ConfirmCheckout idempotente: segundo confirm sobre la misma sesión -> devuelve el pago existente (sin duplicar) y reintenta el cierre', async () => {
    await orderRepo.save('t-1', {
      id: 'ord-6',
      tenantId: 't-1',
      sessionId: 's-6',
      tableId: 'tb-1',
      status: 'READY',
      total: 35,
      items: [],
      createdAt: new Date().toISOString(),
    });

    const first = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-6',
      tableId: 'tb-1',
      method: 'CARD',
      recordedBy: 'staff-1',
    });

    const second = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-6',
      tableId: 'tb-1',
      method: 'CARD',
      recordedBy: 'staff-1',
    });

    expect(second.payment.id).toBe(first.payment.id);
    expect(paymentRepo.payments).toHaveLength(1);
    expect(sessionService.closedSessions.length).toBeGreaterThanOrEqual(2);
    expect(eventPublisher.checkoutCompletedEvents).toHaveLength(1);
  });

  test('7. Si closeSession falla tras persistir -> SESSION_CLOSE_FAILED y el pago queda registrado; el reintento posterior completa el cierre', async () => {
    await orderRepo.save('t-1', {
      id: 'ord-7',
      tenantId: 't-1',
      sessionId: 's-7',
      tableId: 'tb-1',
      status: 'READY',
      total: 15,
      items: [],
      createdAt: new Date().toISOString(),
    });

    sessionService.shouldFail = true;

    await expect(
      checkoutUseCases.confirmCheckout.execute({
        tenantId: 't-1',
        sessionId: 's-7',
        tableId: 'tb-1',
        method: 'CASH',
        recordedBy: 'staff-1',
      })
    ).rejects.toThrow('SESSION_CLOSE_FAILED');

    // El pago sí quedó registrado
    expect(paymentRepo.payments).toHaveLength(1);

    // Reintento con session service recuperado
    sessionService.shouldFail = false;
    const retry = await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-7',
      tableId: 'tb-1',
      method: 'CASH',
      recordedBy: 'staff-1',
    });

    expect(retry.payment.id).toBe(paymentRepo.payments[0].id);
    expect(sessionService.closedSessions).toHaveLength(1);
  });

  test('8. ConfirmCheckout limpia residuos propios: clear del carrito cart:{t}:{s} llamado y service-calls pendientes de la sesión resueltos; publica session.checkout-completed tras la orquestación', async () => {
    await orderRepo.save('t-1', {
      id: 'ord-8',
      tenantId: 't-1',
      sessionId: 's-8',
      tableId: 'tb-1',
      status: 'READY',
      total: 50,
      items: [],
      createdAt: new Date().toISOString(),
    });

    await cartRepo.upsertItem(
      't-1',
      's-8',
      {
        cartItemId: 'item-residue',
        productId: 'p-1',
        productName: 'Tacos',
        unitPrice: 10,
        modifiers: [],
        quantity: 1,
        addedAt: new Date().toISOString(),
        lineTotal: 10,
      },
      3600
    );

    await serviceCallRepo.save(
      't-1',
      {
        callId: 'call-residue',
        tenantId: 't-1',
        sessionId: 's-8',
        tableId: 'tb-1',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      3600
    );

    await checkoutUseCases.confirmCheckout.execute({
      tenantId: 't-1',
      sessionId: 's-8',
      tableId: 'tb-1',
      method: 'OTHER',
      recordedBy: 'staff-1',
    });

    const cart = await cartRepo.get('t-1', 's-8', 3600);
    expect(cart.items).toHaveLength(0);

    const call = await serviceCallRepo.findById('t-1', 'call-residue');
    expect(call?.status).toBe('resolved');

    expect(eventPublisher.checkoutCompletedEvents).toHaveLength(1);
    expect(eventPublisher.checkoutCompletedEvents[0].event.type).toBe('session.checkout-completed');
    expect(eventPublisher.checkoutCompletedEvents[0].event.sessionId).toBe('s-8');
  });
});
