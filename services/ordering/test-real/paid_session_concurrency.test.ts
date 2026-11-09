import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaOrderRepository } from '../src/infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from '../src/infrastructure/persistence/PrismaPaymentRepository';
import { RedisCartRepository } from '../src/infrastructure/persistence/RedisCartRepository';
import { RedisServiceCallRepository } from '../src/infrastructure/persistence/RedisServiceCallRepository';
import { CartUseCases } from '../src/application/CartUseCases';
import { OrderUseCases } from '../src/application/OrderUseCases';
import { ConfirmCheckout } from '../src/application/ConfirmCheckout';
import { PrismaTransactionCoordinator } from '../src/infrastructure/persistence/PrismaTransactionCoordinator';
import { SessionNotActiveError } from '../src/domain/errors';
import { CatalogValidationPort, SessionServicePort } from '@packages/shared-types';

describe('Ordering Real - Paid Session, Advisory Lock Concurrency & Retries (U4)', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let orderRepo: PrismaOrderRepository;
  let paymentRepo: PrismaPaymentRepository;
  let cartRepo: RedisCartRepository;
  let serviceCallRepo: RedisServiceCallRepository;
  let txCoordinator: PrismaTransactionCoordinator;
  let cartUseCases: CartUseCases;
  let orderUseCases: OrderUseCases;
  let confirmCheckout: ConfirmCheckout;

  const tenantId = `tenant-concurrency-${Date.now()}`;

  const catalogValidation: CatalogValidationPort = {
    getOrderableProducts: async (_tenant, productIds) => {
      return productIds.map((pid) => ({
        productId: pid,
        name: 'Producto Concurrencia',
        price: 15.0,
        isAvailable: true,
        modifierGroups: [],
      }));
    },
  };

  const sessionService: SessionServicePort & {
    getSession?: (t: string, s: string) => Promise<any>;
  } = {
    closeSession: async () => {},
    getSession: async (t, s) => ({
      sessionId: s,
      tenantId: t,
      tableId: s.includes('race') ? 'table-race' : s.includes('retry') ? 'table-retry' : s.includes('paid') ? 'table-paid' : 'table-1',
      status: 'active',
    }),
  };

  beforeAll(async () => {
    const dbUrl = process.env.ORDERING_DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        'Missing required env ORDERING_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'Missing required env REDIS_URL for test:real (refusing to fall back to dev Redis)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    await prisma.$connect();

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    orderRepo = new PrismaOrderRepository(prisma);
    paymentRepo = new PrismaPaymentRepository(prisma);
    cartRepo = new RedisCartRepository(redis);
    serviceCallRepo = new RedisServiceCallRepository(redis);
    txCoordinator = new PrismaTransactionCoordinator(prisma);

    cartUseCases = new CartUseCases(
      cartRepo,
      paymentRepo,
      sessionService,
      orderRepo,
      txCoordinator
    );
    orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      catalogValidation,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );
    confirmCheckout = new ConfirmCheckout(
      orderRepo,
      paymentRepo,
      sessionService,
      cartRepo,
      serviceCallRepo,
      undefined,
      txCoordinator
    );
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.orderItemModifier.deleteMany({
        where: { orderItem: { order: { tenantId } } },
      }).catch(() => {});
      await prisma.orderItem.deleteMany({
        where: { order: { tenantId } },
      }).catch(() => {});
      await prisma.order.deleteMany({
        where: { tenantId },
      }).catch(() => {});
      await prisma.payment.deleteMany({
        where: { tenantId },
      }).catch(() => {});
      await prisma.$disconnect();
    }
    if (redis) {
      const keys = await redis.keys(`resto:${tenantId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  it('serializes concurrent order creation and checkout with pg_advisory_xact_lock: no orphan order', async () => {
    const sessionId = `s-race-${Date.now()}`;
    const tableId = `table-race`;

    // 1. Crear una primera orden para que haya algo que cobrar
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-base',
        productId: 'prod-base',
        productName: 'Producto Base',
        unitPrice: 15.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 15.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    const baseOrder = await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });
    expect(baseOrder.total).toBe(15.0);

    // 2. Colocar un segundo item en el carrito para el pedido concurrente
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-second',
        productId: 'prod-second',
        productName: 'Producto Segundo',
        unitPrice: 15.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 15.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 3. Ejecutar pedido y cobro concurrentemente
    const [orderResult, checkoutResult] = await Promise.allSettled([
      orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId,
        tableId,
      }),
      confirmCheckout.execute({
        tenantId,
        sessionId,
        tableId,
        method: 'CASH',
        recordedBy: 'staff-concurrent',
      }),
    ]);

    // Verificar el estado en Postgres:
    const finalOrders = await orderRepo.listBySession(tenantId, sessionId);
    const finalPayment = await paymentRepo.findBySession(tenantId, sessionId);

    expect(finalPayment).toBeDefined();
    expect(finalPayment).not.toBeNull();

    if (orderResult.status === 'fulfilled') {
      // El pedido ganó el lock o entró antes: ambas órdenes deben estar incluidas en el pago
      expect(finalOrders.length).toBe(2);
      expect(checkoutResult.status).toBe('fulfilled');
      expect(finalPayment!.amount).toBe(30.0);
      expect(finalPayment!.ordersCount).toBe(2);
    } else {
      // El cobro ganó el lock: el cobro cobró la orden base (15.0), y el segundo pedido fue rechazado con SESSION_NOT_ACTIVE
      expect(checkoutResult.status).toBe('fulfilled');
      expect(finalPayment!.amount).toBe(15.0);
      expect(finalPayment!.ordersCount).toBe(1);
      expect(finalOrders.length).toBe(1);
      expect(orderResult.reason).toBeInstanceOf(SessionNotActiveError);
      expect((orderResult.reason as any).code).toBe('SESSION_NOT_ACTIVE');
    }

    // INVARIANTE CRÍTICO: La suma de órdenes en Postgres NUNCA supera el monto del pago
    const totalOrdersAmount = finalOrders.reduce((sum, o) => sum + o.total, 0);
    expect(totalOrdersAmount).toBe(finalPayment!.amount);
  });

  it('rejects cart mutations and order confirm on already paid session in real DB', async () => {
    const sessionId = `s-paid-${Date.now()}`;
    const tableId = `table-paid`;

    // Persistir pago directamente en Postgres
    await paymentRepo.save(tenantId, {
      id: `pay-paid-${Date.now()}`,
      tenantId,
      sessionId,
      tableId,
      amount: 45.0,
      method: 'CARD',
      ordersCount: 2,
      recordedBy: 'staff-1',
      createdAt: new Date().toISOString(),
    });

    // Mutación de carrito debe fallar con SESSION_NOT_ACTIVE
    await expect(
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-item',
        quantity: 1,
        modifiers: [],
        display: { productName: 'Test', unitPrice: 15.0, modifierNames: [] },
      })
    ).rejects.toThrow(SessionNotActiveError);

    // ConfirmOrder debe fallar con SESSION_NOT_ACTIVE
    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId,
        tableId,
      })
    ).rejects.toThrow(SessionNotActiveError);

    // No debe haber órdenes creadas para esa sesión en Postgres
    const orders = await orderRepo.listBySession(tenantId, sessionId);
    expect(orders).toHaveLength(0);
  });

  it('checkout idempotency and retry when closeSession previously failed', async () => {
    const sessionId = `s-retry-${Date.now()}`;
    const tableId = `table-retry`;

    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-retry',
        productId: 'prod-retry',
        productName: 'Producto Retry',
        unitPrice: 15.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 15.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // Simulamos fallo en closeSession en el 1er intento
    let failCloseSession = true;
    const flakeySessionService: SessionServicePort & {
      getSession: (t: string, s: string) => Promise<any>;
    } = {
      getSession: async (t, s) => ({
        sessionId: s,
        tenantId: t,
        tableId,
        status: failCloseSession ? 'active' : 'closed',
      }),
      closeSession: async () => {
        if (failCloseSession) {
          throw new Error('Fallo simulado al llamar al microservicio session close');
        }
      },
    };

    const publishedEvents: any[] = [];
    const eventPublisher: any = {
      publishCheckoutCompleted: async (_tenant: string, event: any) => {
        publishedEvents.push(event);
      },
    };

    const flakeyCheckout = new ConfirmCheckout(
      orderRepo,
      paymentRepo,
      flakeySessionService,
      cartRepo,
      serviceCallRepo,
      eventPublisher,
      txCoordinator
    );

    // Primer intento falla en closeSession, pero el pago debe haber quedado persistido en Postgres
    await expect(
      flakeyCheckout.execute({
        tenantId,
        sessionId,
        tableId,
        method: 'CASH',
        recordedBy: 'staff-1',
      })
    ).rejects.toThrow();

    expect(publishedEvents).toHaveLength(0);

    const paymentAfterFirstAttempt = await paymentRepo.findBySession(tenantId, sessionId);
    expect(paymentAfterFirstAttempt).toBeDefined();
    expect(paymentAfterFirstAttempt!.amount).toBe(15.0);

    // Ahora simular que el servicio de sesiones ya la marca como cerrada (comportamiento normal tras fallo)
    failCloseSession = false;

    // Retry de checkout debe tener éxito, reutilizando el payment existente sin fallar por sesión cerrada
    const retryResult = await flakeyCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CASH',
      recordedBy: 'staff-1',
    });

    expect(retryResult.isExisting).toBe(true);
    expect(retryResult.payment.id).toBe(paymentAfterFirstAttempt!.id);
    expect(retryResult.payment.amount).toBe(paymentAfterFirstAttempt!.amount);
    expect(retryResult.bill.total).toBe(15.0);

    // U4-R6: El retry debe publicar el evento session.checkout-completed exactamente una vez
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].type).toBe('session.checkout-completed');
    expect(publishedEvents[0].sessionId).toBe(sessionId);

    // Un tercer intento idempotente posterior NO debe volver a publicar el evento
    const thirdResult = await flakeyCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CASH',
      recordedBy: 'staff-1',
    });
    expect(thirdResult.isExisting).toBe(true);
    expect(publishedEvents).toHaveLength(1);
  });

  it('serializes addCartItem vs confirmCheckout: addCartItem started before payment cannot persist item after payment', async () => {
    const sessionId = `s-race-add-${Date.now()}`;
    const tableId = `table-race`;

    // 1. Sembrar orden inicial para poder hacer checkout
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-base-order',
        productId: 'prod-base-order',
        productName: 'Base Order',
        unitPrice: 20.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 20.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 2. Preparar sesión y barrera determinista para addCartItem
    let releaseAddCartItem!: () => void;
    const addCartItemBarrierPromise = new Promise<void>((resolve) => {
      releaseAddCartItem = resolve;
    });

    let addCartItemReachedBarrier!: () => void;
    const addCartItemReachedPromise = new Promise<void>((resolve) => {
      addCartItemReachedBarrier = resolve;
    });

    let hookActive = true;
    const coordinatingSessionService: SessionServicePort & {
      getSession: (t: string, s: string) => Promise<any>;
    } = {
      closeSession: async () => {},
      getSession: async (t, s) => {
        if (s === sessionId && hookActive) {
          hookActive = false; // Solo pausar en la llamada de getSession de addCartItem
          addCartItemReachedBarrier();
          await addCartItemBarrierPromise;
        }
        return {
          sessionId: s,
          tenantId: t,
          tableId,
          status: 'active',
        };
      },
    };

    const cartUseCasesForRace = new CartUseCases(
      cartRepo,
      paymentRepo,
      coordinatingSessionService,
      orderRepo,
      txCoordinator
    );

    // 3. Iniciar addCartItem (pasará getSession y quedará pausado en la barrera)
    const addPromise = cartUseCasesForRace.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-late-addition',
      quantity: 1,
      modifiers: [],
      display: { productName: 'Late Addition', unitPrice: 25.0, modifierNames: [] },
    });

    // Esperar a que addCartItem haya pasado la validación de sesión
    await addCartItemReachedPromise;

    // 4. Mientras addCartItem está pausado, ejecutar confirmCheckout completo
    const checkoutResult = await confirmCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CARD',
      recordedBy: 'staff-race',
    });
    expect(checkoutResult.payment).toBeDefined();

    // 5. Liberar addCartItem para que intente persistir en Redis
    releaseAddCartItem();

    // Debe ser rechazado con SessionNotActiveError porque la sesión ya fue pagada
    await expect(addPromise).rejects.toThrow(SessionNotActiveError);

    // El carrito en Redis debe quedar completamente vacío (0 items)
    const cartAfter = await cartRepo.get(tenantId, sessionId, 60);
    expect(cartAfter.items).toHaveLength(0);
  });

  it('U4-R7: recovers session.checkout-completed event if eventPublisher fails after payment and session close, delivering pending event on retry without duplicates', async () => {
    const sessionId = `s-pub-fail-${Date.now()}`;
    const tableId = `table-1`;

    // 1. Sembrar orden inicial para la sesión
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-pub-fail',
        productId: 'prod-pub-fail',
        productName: 'Producto Pub Fail',
        unitPrice: 15.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 15.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 2. Publisher flakey: falla la primera vez tras cerrar sesión
    let failPublish = true;
    const publishedEvents: any[] = [];
    const flakeyPublisher = {
      publishOrderEvent: async () => {},
      publishServiceCallEvent: async () => {},
      publishCheckoutCompleted: async (_tenant: string, event: any) => {
        if (failPublish) {
          throw new Error('Broker connection reset before ack');
        }
        publishedEvents.push(event);
      },
    };

    const flakeyCheckout = new ConfirmCheckout(
      orderRepo,
      paymentRepo,
      sessionService,
      cartRepo,
      serviceCallRepo,
      flakeyPublisher,
      txCoordinator
    );

    // Intento 1: closeSession tiene éxito pero publisher falla antes de ack
    await expect(
      flakeyCheckout.execute({
        tenantId,
        sessionId,
        tableId,
        method: 'CASH',
        recordedBy: 'staff-u4',
      })
    ).rejects.toThrow('Broker connection reset before ack');

    // El pago ya quedó persistido en Postgres
    const payment = await paymentRepo.findBySession(tenantId, sessionId);
    expect(payment).toBeDefined();
    expect(payment!.amount).toBe(15.0);
    // En el intento 1 fallido, ningún evento fue entregado
    expect(publishedEvents).toHaveLength(0);

    // Broker vuelve a estar operativo
    failPublish = false;

    // Intento 2 (retry): debe recuperar y entregar el evento pendiente
    const retryResult = await flakeyCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CASH',
      recordedBy: 'staff-u4',
    });

    expect(retryResult.isExisting).toBe(true);
    expect(retryResult.payment.id).toBe(payment!.id);
    expect(retryResult.payment.amount).toBe(15.0);

    // Asignación de RED vs GREEN:
    // En R6, markCheckoutCompleted fijaba NX antes de publicar, por lo que el retry omitía el evento
    // y publishedEvents tenía longitud 0 (evento suprimido para siempre).
    // En R7, el retry debe entregar el evento pendiente.
    expect(publishedEvents).toHaveLength(1);
    const expectedEventId = `checkout-completed:${tenantId}:${sessionId}:${payment!.id}`;
    expect(publishedEvents[0].type).toBe('session.checkout-completed');
    expect(publishedEvents[0].sessionId).toBe(sessionId);
    expect(publishedEvents[0].eventId).toBe(expectedEventId);

    // Intento 3 (retry adicional): idempotente, no vuelve a publicar en el bus
    const thirdResult = await flakeyCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CASH',
      recordedBy: 'staff-u4',
    });
    expect(thirdResult.isExisting).toBe(true);
    expect(publishedEvents).toHaveLength(1);

    // Deduplicación en el consumidor con consumeCheckoutEventOnce:
    // Incluso ante retransmisión duplicada por transporte, el efecto observable ocurre exactamente una vez
    const firstConsume = await cartRepo.consumeCheckoutEventOnce(publishedEvents[0].eventId);
    expect(firstConsume).toBe(true);

    const duplicateConsume = await cartRepo.consumeCheckoutEventOnce(publishedEvents[0].eventId);
    expect(duplicateConsume).toBe(false);
  });
});
