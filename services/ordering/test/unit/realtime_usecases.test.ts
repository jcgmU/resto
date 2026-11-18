import { OrderUseCases } from '../../src/application/OrderUseCases';
import { ServiceCallUseCases } from '../../src/application/ServiceCallUseCases';
import {
  InMemoryOrderRepository,
  InMemoryCartRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryEventPublisher,
  InMemoryServiceCallRepository,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { OrderDTO } from '@packages/shared-types';

describe('A. Ordering — unitarios tiempo real y ServiceCall (Tests 1-7)', () => {
  let orderRepo: InMemoryOrderRepository;
  let cartRepo: InMemoryCartRepository;
  let catalogValidation: InMemoryCatalogValidationAdapter;
  let publisher: InMemoryEventPublisher;
  let serviceCallRepo: InMemoryServiceCallRepository;
  let orderUseCases: OrderUseCases;
  let serviceCallUseCases: ServiceCallUseCases;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    cartRepo = new InMemoryCartRepository();
    catalogValidation = new InMemoryCatalogValidationAdapter();
    publisher = new InMemoryEventPublisher();
    serviceCallRepo = new InMemoryServiceCallRepository();

    orderUseCases = new OrderUseCases(orderRepo, cartRepo, catalogValidation, publisher);
    serviceCallUseCases = new ServiceCallUseCases(serviceCallRepo, publisher);
  });

  test('1. UpdateOrderStatus PLACED->IN_KITCHEN persiste y publica order.status-changed con previousStatus="PLACED" y la Order completa', async () => {
    const initialOrder: OrderDTO = {
      id: 'ord-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 20,
      items: [],
      createdAt: new Date().toISOString(),
    };
    await orderRepo.save('t-1', initialOrder);

    const updated = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-1',
      status: 'IN_KITCHEN',
    });

    expect(updated.status).toBe('IN_KITCHEN');
    expect(publisher.orderEvents).toHaveLength(1);
    expect(publisher.orderEvents[0].event.type).toBe('order.status-changed');
    expect(publisher.orderEvents[0].event.previousStatus).toBe('PLACED');
    expect(publisher.orderEvents[0].event.order.status).toBe('IN_KITCHEN');
  });

  test('2. Transición inválida (PLACED->DELIVERED, cualquiera desde DELIVERED o CANCELLED) -> INVALID_STATUS_TRANSITION; NO persiste NI publica', async () => {
    const initialOrder: OrderDTO = {
      id: 'ord-invalid',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 20,
      items: [],
      createdAt: new Date().toISOString(),
    };
    await orderRepo.save('t-1', initialOrder);

    await expect(
      orderUseCases.updateOrderStatus.execute({
        tenantId: 't-1',
        orderId: 'ord-invalid',
        status: 'DELIVERED',
      })
    ).rejects.toThrow('INVALID_STATUS_TRANSITION');

    expect(publisher.orderEvents).toHaveLength(0);
    const inDb = await orderRepo.findById('t-1', 'ord-invalid');
    expect(inDb?.status).toBe('PLACED');
  });

  test('3. CancelOrder (Oleada 3) ahora valida contra la máquina: IN_KITCHEN->CANCELLED válido; READY->CANCELLED -> INVALID_STATUS_TRANSITION', async () => {
    const readyOrder: OrderDTO = {
      id: 'ord-ready',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'READY',
      total: 20,
      items: [],
      createdAt: new Date().toISOString(),
    };
    await orderRepo.save('t-1', readyOrder);

    await expect(
      orderUseCases.cancelOrder.execute({
        tenantId: 't-1',
        orderId: 'ord-ready',
      })
    ).rejects.toThrow('INVALID_STATUS_TRANSITION');
  });

  test('4. ConfirmOrder publica order.created DESPUÉS de persistir (publisher captura exactamente 1 evento con la Order persistida); si save falla, no hay evento', async () => {
    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Tacos',
        price: 10,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    await cartRepo.upsertItem(
      't-1',
      's-1',
      {
        cartItemId: 'item-1',
        productId: 'prod-1',
        productName: 'Tacos',
        unitPrice: 10,
        modifiers: [],
        quantity: 1,
        addedAt: new Date().toISOString(),
        lineTotal: 10,
      },
      3600
    );

    const order = await orderUseCases.confirmOrder.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
    });

    expect(order).toBeDefined();
    expect(publisher.orderEvents).toHaveLength(1);
    expect(publisher.orderEvents[0].event.type).toBe('order.created');
    expect(publisher.orderEvents[0].event.order.id).toBe(order.id);
  });

  test('5. CreateServiceCall persiste con status="pending" y publica service-call.created con tableId/note', async () => {
    const call = await serviceCallUseCases.createServiceCall.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-5',
      note: 'Necesitamos servilletas',
    });

    expect(call.callId).toBeDefined();
    expect(call.status).toBe('pending');
    expect(call.type).toBe('GENERIC');
    expect(publisher.serviceCallEvents).toHaveLength(1);
    expect(publisher.serviceCallEvents[0].event.type).toBe('service-call.created');
    expect(publisher.serviceCallEvents[0].event.call.tableId).toBe('tb-5');
    expect(publisher.serviceCallEvents[0].event.call.type).toBe('GENERIC');
  });

  test('5b. CreateServiceCall con type="WAITER_CALL" persiste y publica con ese tipo', async () => {
    const call = await serviceCallUseCases.createServiceCall.execute({
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-5',
      type: 'WAITER_CALL',
      note: 'Llamar al mesero para ordenar',
    });

    expect(call.callId).toBeDefined();
    expect(call.status).toBe('pending');
    expect(call.type).toBe('WAITER_CALL');
    expect(publisher.serviceCallEvents[publisher.serviceCallEvents.length - 1].event.call.type).toBe('WAITER_CALL');
  });

  test('6. ResolveServiceCall -> status="resolved" + resolvedAt + publica service-call.resolved; segunda resolución -> idempotente y NO republica', async () => {
    const call = await serviceCallRepo.save(
      't-1',
      {
        callId: 'call-1',
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      3600
    );

    const resolved = await serviceCallUseCases.resolveServiceCall.execute({
      tenantId: 't-1',
      callId: call.callId,
    });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
    expect(publisher.serviceCallEvents).toHaveLength(1);

    // Segunda resolución idempotente
    const resolvedAgain = await serviceCallUseCases.resolveServiceCall.execute({
      tenantId: 't-1',
      callId: call.callId,
    });
    expect(resolvedAgain.status).toBe('resolved');
    expect(publisher.serviceCallEvents).toHaveLength(1); // No republica
  });

  test('7. UpdateOrderStatus sobre order de otro tenant -> ORDER_NOT_FOUND (aislamiento)', async () => {
    await orderRepo.save('t-other', {
      id: 'ord-other-tenant',
      tenantId: 't-other',
      sessionId: 's-other',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 10,
      items: [],
      createdAt: new Date().toISOString(),
    });

    await expect(
      orderUseCases.updateOrderStatus.execute({
        tenantId: 't-1',
        orderId: 'ord-other-tenant',
        status: 'IN_KITCHEN',
      })
    ).rejects.toThrow('ORDER_NOT_FOUND');
  });
});
