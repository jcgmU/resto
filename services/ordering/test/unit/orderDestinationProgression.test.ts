import { OrderUseCases } from '../../src/application/OrderUseCases';
import {
  InMemoryOrderRepository,
  InMemoryCartRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryEventPublisher,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { OrderDTO } from '@packages/shared-types';
import { InvalidStatusTransitionError } from '../../src/domain/errors';

describe('U16 — Destination status progression (kitchen / bar / mixed)', () => {
  let orderRepo: InMemoryOrderRepository;
  let cartRepo: InMemoryCartRepository;
  let catalogValidation: InMemoryCatalogValidationAdapter;
  let publisher: InMemoryEventPublisher;
  let orderUseCases: OrderUseCases;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    cartRepo = new InMemoryCartRepository();
    catalogValidation = new InMemoryCatalogValidationAdapter();
    publisher = new InMemoryEventPublisher();

    orderUseCases = new OrderUseCases(orderRepo, cartRepo, catalogValidation, publisher);
  });

  test('Mixed order: bar reaches READY while kitchen is PLACED -> global remains PLACED until both advance', async () => {
    const initialOrder: OrderDTO = {
      id: 'ord-mixed-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 't-10',
      status: 'PLACED',
      kitchenStatus: 'PLACED',
      barStatus: 'PLACED',
      destinationStatus: { kitchen: 'PLACED', bar: 'PLACED' },
      total: 35000,
      items: [
        {
          id: 'item-1',
          productId: 'prod-burger',
          productName: 'Burger',
          unitPrice: 25000,
          quantity: 1,
          destination: 'kitchen',
          modifiers: [],
        },
        {
          id: 'item-2',
          productId: 'prod-beer',
          productName: 'Beer',
          unitPrice: 10000,
          quantity: 1,
          destination: 'bar',
          modifiers: [],
        },
      ],
      createdAt: new Date().toISOString(),
    };
    await orderRepo.save('t-1', initialOrder);

    // 1. Bar marks IN_KITCHEN
    const step1a = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-mixed-1',
      status: 'IN_KITCHEN',
      destination: 'bar',
    });
    expect(step1a.barStatus).toBe('IN_KITCHEN');
    expect(step1a.kitchenStatus).toBe('PLACED');
    expect(step1a.status).toBe('PLACED'); // Global is least advanced (PLACED)

    // 2. Bar marks READY
    const step1b = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-mixed-1',
      status: 'READY',
      destination: 'bar',
    });

    expect(step1b.barStatus).toBe('READY');
    expect(step1b.kitchenStatus).toBe('PLACED');
    expect(step1b.status).toBe('PLACED'); // Global is still PLACED

    // 3. Kitchen marks IN_KITCHEN
    const step2 = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-mixed-1',
      status: 'IN_KITCHEN',
      destination: 'kitchen',
    });

    expect(step2.barStatus).toBe('READY');
    expect(step2.kitchenStatus).toBe('IN_KITCHEN');
    expect(step2.status).toBe('IN_KITCHEN'); // Global advances to IN_KITCHEN

    // 4. Kitchen marks READY
    const step3 = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-mixed-1',
      status: 'READY',
      destination: 'kitchen',
    });

    expect(step3.barStatus).toBe('READY');
    expect(step3.kitchenStatus).toBe('READY');
    expect(step3.status).toBe('READY'); // Both are READY, so global is READY!

    // 5. Waiter marks DELIVERED without destination -> both advance to DELIVERED
    const step4 = await orderUseCases.updateOrderStatus.execute({
      tenantId: 't-1',
      orderId: 'ord-mixed-1',
      status: 'DELIVERED',
    });

    expect(step4.status).toBe('DELIVERED');
    expect(step4.kitchenStatus).toBe('DELIVERED');
    expect(step4.barStatus).toBe('DELIVERED');
  });

  test('Destination invalid transition rejects with InvalidStatusTransitionError', async () => {
    const initialOrder: OrderDTO = {
      id: 'ord-kitchen-only',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 't-10',
      status: 'PLACED',
      kitchenStatus: 'PLACED',
      destinationStatus: { kitchen: 'PLACED' },
      total: 25000,
      items: [
        {
          id: 'item-1',
          productId: 'prod-burger',
          productName: 'Burger',
          unitPrice: 25000,
          quantity: 1,
          destination: 'kitchen',
          modifiers: [],
        },
      ],
      createdAt: new Date().toISOString(),
    };
    await orderRepo.save('t-1', initialOrder);

    // PLACED directly to DELIVERED is invalid
    await expect(
      orderUseCases.updateOrderStatus.execute({
        tenantId: 't-1',
        orderId: 'ord-kitchen-only',
        status: 'DELIVERED',
        destination: 'kitchen',
      })
    ).rejects.toThrow(InvalidStatusTransitionError);
  });
});
