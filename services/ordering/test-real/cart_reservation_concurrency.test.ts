import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createOrderingApp } from '../src/app';
import { PrismaOrderRepository } from '../src/infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from '../src/infrastructure/persistence/PrismaPaymentRepository';
import { RedisCartRepository } from '../src/infrastructure/persistence/RedisCartRepository';
import { RedisServiceCallRepository } from '../src/infrastructure/persistence/RedisServiceCallRepository';
import { PrismaTransactionCoordinator } from '../src/infrastructure/persistence/PrismaTransactionCoordinator';
import { OrderUseCases } from '../src/application/OrderUseCases';
import { CartUseCases } from '../src/application/CartUseCases';
import { CartBusyError, ValidationError } from '../src/domain/errors';
import {
  CatalogValidationPort,
  EventPublisher,
  SessionServicePort,
} from '@packages/shared-types';

describe('Ordering Real - Cart Reservation & Concurrency (U9)', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let redis2: Redis;
  let orderRepo: PrismaOrderRepository;
  let paymentRepo: PrismaPaymentRepository;
  let cartRepo: RedisCartRepository;
  let txCoordinator: PrismaTransactionCoordinator;

  const tenantId = `tenant-u9-${Date.now()}`;
  const tableId = 'table-u9-1';

  const sessionService: SessionServicePort & {
    getSession?: (t: string, s: string) => Promise<any>;
  } = {
    closeSession: async () => {},
    getSession: async (t, s) => ({
      sessionId: s,
      tenantId: t,
      tableId,
      status: 'active',
    }),
  };

  const catalogValidation: CatalogValidationPort = {
    getOrderableProducts: async (_tenant, productIds) => {
      return productIds.map((pid) => ({
        productId: pid,
        name: `Prod-${pid}`,
        price: 15.0,
        isAvailable: true,
        modifierGroups: [],
      }));
    },
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
    redis2 = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    orderRepo = new PrismaOrderRepository(prisma);
    paymentRepo = new PrismaPaymentRepository(prisma);
    cartRepo = new RedisCartRepository(redis);
    txCoordinator = new PrismaTransactionCoordinator(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.orderItemModifier
        .deleteMany({
          where: { orderItem: { order: { tenantId } } },
        })
        .catch(() => {});
      await prisma.orderItem
        .deleteMany({
          where: { order: { tenantId } },
        })
        .catch(() => {});
      await prisma.order
        .deleteMany({
          where: { tenantId },
        })
        .catch(() => {});
      await prisma.payment
        .deleteMany({
          where: { tenantId },
        })
        .catch(() => {});
      await prisma.$disconnect();
    }
    if (redis2) {
      await redis2.quit().catch(() => {});
    }
    if (redis) {
      const keys = await redis.keys(`*${tenantId}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  it('Test 1a: concurrent addition of line B during confirmOrder of A creates order with A and keeps B in live cart', async () => {
    const sessionId = `s-u9-1a-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    // 1. Sembrar A en el carrito vivo
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-A',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto A',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    // 2. Mock de catalogValidation con barrera determinista
    let releaseCatalog!: () => void;
    const catalogBarrier = new Promise<void>((resolve) => {
      releaseCatalog = resolve;
    });

    let catalogEnteredResolve!: () => void;
    const catalogEntered = new Promise<void>((resolve) => {
      catalogEnteredResolve = resolve;
    });

    const slowCatalog: CatalogValidationPort = {
      getOrderableProducts: async (_t, productIds) => {
        catalogEnteredResolve();
        await catalogBarrier;
        return productIds.map((pid) => ({
          productId: pid,
          name: `Prod-${pid}`,
          price: 15.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      slowCatalog,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    // 3. Iniciar confirmOrder en segundo plano
    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 4. Esperar a que confirmOrder reserve A y pause en catálogo
    await catalogEntered;

    // 5. Mientras confirmOrder está en pausa, un cliente añade B al carrito vivo
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-B',
      quantity: 1,
      modifiers: [],
      display: {
        productName: 'Producto B',
        unitPrice: 20.0,
        modifierNames: [],
      },
    });

    // 6. Liberar la barrera de catálogo
    releaseCatalog();

    const confirmedOrder = await confirmPromise;
    expect(confirmedOrder.id).toBeDefined();

    // 7. En Postgres existe 1 sola Order y contiene únicamente A
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].items).toHaveLength(1);
    expect(ordersInDb[0].items[0].productId).toBe('prod-A');
    expect(ordersInDb[0].items[0].quantity).toBe(2);

    // 8. En Redis el carrito vivo contiene únicamente B
    const liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(1);
    expect(liveCart.items[0].productId).toBe('prod-B');
    expect(liveCart.items[0].quantity).toBe(1);
  });

  it('Test 1b: concurrent addition of SAME canonical line A during confirmOrder of A creates order with original qty and keeps added qty in live cart', async () => {
    const sessionId = `s-u9-1b-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    // 1. Sembrar A con qty: 2
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-A-same',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto A Same',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    let releaseCatalog!: () => void;
    const catalogBarrier = new Promise<void>((resolve) => {
      releaseCatalog = resolve;
    });

    let catalogEnteredResolve!: () => void;
    const catalogEntered = new Promise<void>((resolve) => {
      catalogEnteredResolve = resolve;
    });

    const slowCatalog: CatalogValidationPort = {
      getOrderableProducts: async (_t, productIds) => {
        catalogEnteredResolve();
        await catalogBarrier;
        return productIds.map((pid) => ({
          productId: pid,
          name: `Prod-${pid}`,
          price: 15.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      slowCatalog,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await catalogEntered;

    // Añadir la misma línea canónica con qty: 3
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-A-same',
      quantity: 3,
      modifiers: [],
      display: {
        productName: 'Producto A Same',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    releaseCatalog();

    const confirmedOrder = await confirmPromise;
    expect(confirmedOrder.items).toHaveLength(1);
    expect(confirmedOrder.items[0].quantity).toBe(2);

    // En Postgres: orden con quantity 2
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].items[0].quantity).toBe(2);

    // En Redis: carrito vivo con quantity 3
    const liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(1);
    expect(liveCart.items[0].productId).toBe('prod-A-same');
    expect(liveCart.items[0].quantity).toBe(3);
  });

  it('Test 2: DB failure on orderRepo.save restores reserved items merged with new additions and emits no events', async () => {
    const sessionId = `s-u9-2-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    // 1. Sembrar A con qty: 2
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-fail-A',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto Fail A',
        unitPrice: 10.0,
        modifierNames: [],
      },
    });

    let releaseDb!: () => void;
    const dbBarrier = new Promise<void>((resolve) => {
      releaseDb = resolve;
    });

    let dbEnteredResolve!: () => void;
    const dbEntered = new Promise<void>((resolve) => {
      dbEnteredResolve = resolve;
    });

    // Decorador sobre orderRepo para pausar y fallar
    const failingOrderRepo = Object.create(orderRepo);
    failingOrderRepo.save = async (t: string, order: any, tx: any) => {
      dbEnteredResolve();
      await dbBarrier;
      throw new Error('DB connection lost during save');
    };

    const mockEventPublisher: EventPublisher = {
      publishOrderEvent: jest.fn().mockResolvedValue(undefined),
      publishCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
      publishServiceCallEvent: jest.fn().mockResolvedValue(undefined),
    };

    const orderUseCases = new OrderUseCases(
      failingOrderRepo,
      cartRepo,
      catalogValidation,
      mockEventPublisher,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await dbEntered;

    // Mientras está pausado en el paso de BD tras haber reservado A:
    // cliente añade A (qty: 3) y B (qty: 1)
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-fail-A',
      quantity: 3,
      modifiers: [],
      display: {
        productName: 'Producto Fail A',
        unitPrice: 10.0,
        modifierNames: [],
      },
    });

    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-fail-B',
      quantity: 1,
      modifiers: [],
      display: {
        productName: 'Producto Fail B',
        unitPrice: 25.0,
        modifierNames: [],
      },
    });

    // Liberar BD para que falle
    releaseDb();

    await expect(confirmPromise).rejects.toThrow('DB connection lost during save');

    // Verificar en Postgres: 0 órdenes
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(0);

    // EventPublisher: 0 eventos emitidos
    expect(mockEventPublisher.publishOrderEvent).not.toHaveBeenCalled();

    // En Redis: el carrito vivo tiene A fusionado con qty: 5 (2 + 3) y B con qty: 1
    const liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(2);

    const itemA = liveCart.items.find((i) => i.productId === 'prod-fail-A');
    const itemB = liveCart.items.find((i) => i.productId === 'prod-fail-B');
    expect(itemA).toBeDefined();
    expect(itemA!.quantity).toBe(5);
    expect(itemB).toBeDefined();
    expect(itemB!.quantity).toBe(1);

    // Clave de reserva ya no existe
    const pendingRes = await (cartRepo as any).findReservation(tenantId, sessionId);
    expect(pendingRes).toBeNull();
  });

  it('Test 3: two concurrent confirmOrder on same cart do not duplicate the order', async () => {
    const sessionId = `s-u9-3-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-concurrent',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto Concurrent',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      catalogValidation,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    const results = await Promise.allSettled([
      orderUseCases.confirmOrder.execute({ tenantId, sessionId, tableId }),
      orderUseCases.confirmOrder.execute({ tenantId, sessionId, tableId }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactamente 1 tiene éxito
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // El rechazado falla con CART_BUSY o CART_EMPTY
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(['CART_BUSY', 'CART_EMPTY']).toContain(reason.code);

    // En Postgres hay 1 sola orden creada
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);

    // Carrito vivo queda vacío
    const liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(0);
  });

  it('Test 4: two concurrent additions to same canonical line accumulate quantities without loss and respect 99 cap', async () => {
    const sessionId = `s-u9-4-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    // 1. Concurrent additions: 4 + 5 = 9
    await Promise.all([
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-merge',
        quantity: 4,
        modifiers: [],
        display: {
          productName: 'Producto Merge',
          unitPrice: 10.0,
          modifierNames: [],
        },
      }),
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-merge',
        quantity: 5,
        modifiers: [],
        display: {
          productName: 'Producto Merge',
          unitPrice: 10.0,
          modifierNames: [],
        },
      }),
    ]);

    let liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(1);
    expect(liveCart.items[0].quantity).toBe(9);

    // 2. Concurrent additions attempting to exceed 99: 9 + 60 = 69, 69 + 50 = 119 (> 99)
    const results = await Promise.allSettled([
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-merge',
        quantity: 60,
        modifiers: [],
        display: {
          productName: 'Producto Merge',
          unitPrice: 10.0,
          modifierNames: [],
        },
      }),
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-merge',
        quantity: 50,
        modifiers: [],
        display: {
          productName: 'Producto Merge',
          unitPrice: 10.0,
          modifierNames: [],
        },
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(ValidationError);

    // Verificar en Redis que la cantidad final quedó en 69 (o respetó el tope)
    liveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(1);
    expect(liveCart.items[0].quantity).toBe(69);
  });

  it('Test 5: PATCH and DELETE on reserved item return 409 CART_BUSY while confirm is in progress', async () => {
    const sessionId = `s-u9-5-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    // Sembrar A con cartItemId específico
    const initialCart = await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-busy',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto Busy',
        unitPrice: 10.0,
        modifierNames: [],
      },
    });

    const targetCartItemId = initialCart.items[0].cartItemId;

    let releaseCatalog!: () => void;
    const catalogBarrier = new Promise<void>((resolve) => {
      releaseCatalog = resolve;
    });

    let catalogEnteredResolve!: () => void;
    const catalogEntered = new Promise<void>((resolve) => {
      catalogEnteredResolve = resolve;
    });

    const slowCatalog: CatalogValidationPort = {
      getOrderableProducts: async (_t, productIds) => {
        catalogEnteredResolve();
        await catalogBarrier;
        return productIds.map((pid) => ({
          productId: pid,
          name: `Prod-${pid}`,
          price: 10.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      slowCatalog,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await catalogEntered;

    // Intentar updateCartItemQuantity y removeCartItem mientras confirmOrder está activo
    await expect(
      cartUseCases.updateCartItemQuantity.execute({
        tenantId,
        sessionId,
        cartItemId: targetCartItemId,
        quantity: 5,
      })
    ).rejects.toThrow(CartBusyError);

    await expect(
      cartUseCases.removeCartItem.execute({
        tenantId,
        sessionId,
        cartItemId: targetCartItemId,
      })
    ).rejects.toThrow(CartBusyError);

    // Liberar catálogo
    releaseCatalog();

    const confirmed = await confirmPromise;
    expect(confirmed.items[0].productId).toBe('prod-busy');
    expect(confirmed.items[0].quantity).toBe(2);
  });

  it('Test 6: failure after Postgres commit before ack recovers idempotently on retry without duplicating order', async () => {
    const sessionId = `s-u9-6-${Date.now()}`;
    const cartUseCases = new CartUseCases(cartRepo, paymentRepo, sessionService);

    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-retry',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto Retry',
        unitPrice: 12.0,
        modifierNames: [],
      },
    });

    // Decorador sobre cartRepo para fallar solo en el primer ackReservation
    let ackCallCount = 0;
    const originalAck = (cartRepo as any).ackReservation.bind(cartRepo);
    (cartRepo as any).ackReservation = async (t: string, s: string, opId?: string) => {
      ackCallCount++;
      if (ackCallCount === 1) {
        throw new Error('Redis failure on ackReservation simulation');
      }
      return originalAck(t, s, opId);
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      catalogValidation,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    // Primera ejecución: debe fallar en ack
    await expect(
      orderUseCases.confirmOrder.execute({ tenantId, sessionId, tableId })
    ).rejects.toThrow('Redis failure on ackReservation simulation');

    // Verificar: en Postgres la orden SÍ se guardó
    const ordersAfterFail = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersAfterFail).toHaveLength(1);
    const existingOrderId = ordersAfterFail[0].id;

    // Y en Redis la reserva huérfana aún existe
    const orphanReservation = await (cartRepo as any).findReservation(tenantId, sessionId);
    expect(orphanReservation).not.toBeNull();
    expect(orphanReservation.orderId).toBe(existingOrderId);

    // Reintentar confirmOrder
    const retriedOrder = await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // Retorna la orden existente sin duplicarla
    expect(retriedOrder.id).toBe(existingOrderId);

    // Postgres sigue teniendo exactamente 1 orden
    const ordersAfterRetry = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersAfterRetry).toHaveLength(1);

    // Reserva quedó limpiada
    const resAfterRetry = await (cartRepo as any).findReservation(tenantId, sessionId);
    expect(resAfterRetry).toBeNull();
  });

  it('Test 7: restore conflict exceeding 99 preserves both reservation and live cart without truncating or discarding', async () => {
    const sessionId = `s-u9-7-${Date.now()}`;
    const cartUseCases = new CartUseCases(
      cartRepo,
      paymentRepo,
      sessionService,
      orderRepo,
      txCoordinator
    );

    // 1. Sembrar 60 unidades y reservarlas (simulando reserva huérfana sin orden en Postgres)
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-conflict-99',
      quantity: 60,
      modifiers: [],
      display: {
        productName: 'Producto Conflicto 99',
        unitPrice: 10.0,
        modifierNames: [],
      },
    });

    const reserveRes = await cartRepo.reserveCart(
      tenantId,
      sessionId,
      'op-orphan-conflict',
      `ord-orphan-conflict-${Date.now()}`,
      7200
    );
    expect(reserveRes.status).toBe('RESERVED');
    await cartRepo.releaseReservationLease(tenantId, sessionId, 'op-orphan-conflict');

    // 2. Sembrar directamente 50 unidades de la misma línea en el carrito vivo (60 + 50 = 110 > 99)
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-live-50',
        productId: 'prod-conflict-99',
        productName: 'Producto Conflicto 99',
        unitPrice: 10.0,
        modifiers: [],
        quantity: 50,
        lineTotal: 500.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 3. Al intentar recuperar la reserva huérfana desde un camino coordinado, devuelve CartBusyError (CONFLICT)
    await expect(
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-other',
        quantity: 1,
        modifiers: [],
        display: {
          productName: 'Otro',
          unitPrice: 5.0,
          modifierNames: [],
        },
      })
    ).rejects.toThrow(CartBusyError);

    // 4. Ni la reserva (60) ni el carrito vivo (50) fueron truncados ni descartados
    const preservedReservation = await cartRepo.findReservation(tenantId, sessionId);
    expect(preservedReservation).not.toBeNull();
    expect(preservedReservation!.items).toHaveLength(1);
    expect(preservedReservation!.items[0].quantity).toBe(60);

    const preservedLiveCart = await cartRepo.get(tenantId, sessionId, 7200);
    expect(preservedLiveCart.items).toHaveLength(1);
    expect(preservedLiveCart.items[0].quantity).toBe(50);
  });

  it('Test 8: HTTP PATCH /cart/items/:id and DELETE /cart/items/:id return HTTP 409 CART_BUSY while item is reserved', async () => {
    const sessionId = `s-u9-8-${Date.now()}`;
    const app = createOrderingApp({
      cartRepo,
      orderRepo,
      catalogValidation,
      serviceCallRepo: new RedisServiceCallRepository(redis),
      eventPublisher: {
        publishOrderEvent: async () => {},
        publishServiceCallEvent: async () => {},
        publishCheckoutCompleted: async () => {},
      },
      paymentRepo,
      sessionService,
      txCoordinator,
    });

    const addRes = await request(app)
      .post('/cart/items')
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId)
      .set('x-user-role', 'guest')
      .send({
        productId: 'prod-http-busy',
        quantity: 2,
        modifiers: [],
        display: {
          productName: 'Prod HTTP Busy',
          unitPrice: 15.0,
          modifierNames: [],
        },
      });
    expect(addRes.status).toBe(201);
    const reservedItemId = addRes.body.items[0].cartItemId;

    const { markOperationInFlight, markOperationFinished } = await import(
      '../src/application/ports/CartReservationPort'
    );
    const opId = `op-http-in-flight-${Date.now()}`;
    markOperationInFlight(opId);

    try {
      await cartRepo.reserveCart(tenantId, sessionId, opId, `ord-http-${Date.now()}`, 7200);

      const patchRes = await request(app)
        .patch(`/cart/items/${reservedItemId}`)
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .set('x-user-role', 'guest')
        .send({ quantity: 4 });
      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error?.code).toBe('CART_BUSY');

      const delRes = await request(app)
        .delete(`/cart/items/${reservedItemId}`)
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .set('x-user-role', 'guest');
      expect(delRes.status).toBe(409);
      expect(delRes.body.error?.code).toBe('CART_BUSY');
    } finally {
      markOperationFinished(opId);
      await cartRepo.ackReservation(tenantId, sessionId, opId);
    }
  });

  it('Test 9 (RED reproduction): multi-instance Redis ownership prevents duplicate orders during in-flight confirmation (U9-R6)', async () => {
    const sessionId = `s-u9-multi-1-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis);
    const cartRepo2 = new RedisCartRepository(redis2);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const cartUseCases1 = new CartUseCases(cartRepo1, paymentRepo, sessionService);

    // 1. Sembrar A en el carrito vivo
    await cartUseCases1.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-multi-A',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto Multi A',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    // 2. Barrera determinista para Instancia 1 en catálogo
    let releaseCatalog1!: () => void;
    const catalogBarrier1 = new Promise<void>((resolve) => {
      releaseCatalog1 = resolve;
    });

    let catalogEnteredResolve1!: () => void;
    const catalogEntered1 = new Promise<void>((resolve) => {
      catalogEnteredResolve1 = resolve;
    });

    const slowCatalog1: CatalogValidationPort = {
      getOrderableProducts: async (_t, productIds) => {
        catalogEnteredResolve1();
        await catalogBarrier1;
        return productIds.map((pid) => ({
          productId: pid,
          name: `Prod-${pid}`,
          price: 15.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases1 = new OrderUseCases(
      orderRepo,
      cartRepo1,
      slowCatalog1,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    const orderUseCases2 = new OrderUseCases(
      orderRepo2,
      cartRepo2,
      catalogValidation,
      undefined,
      paymentRepo2,
      sessionService,
      txCoordinator2
    );

    // 3. Iniciar confirmOrder en Instancia 1
    const confirmPromise1 = orderUseCases1.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 4. Esperar a que Instancia 1 reserve y quede pausada en catálogo
    await catalogEntered1;

    // 5. Simular dos procesos independientes: Instancia 2 no comparte la memoria local de Instancia 1
    const { clearInFlightOperations } = await import('../src/application/ports/CartReservationPort');
    clearInFlightOperations();

    // 6. Instancia 2 intenta confirmar la misma sesión mientras Instancia 1 sigue en catálogo.
    // DEBE fallar con CartBusyError debido al ownership distribuido en Redis, sin restaurar la reserva.
    await expect(
      orderUseCases2.confirmOrder.execute({
        tenantId,
        sessionId,
        tableId,
      })
    ).rejects.toThrow(CartBusyError);

    // 7. Liberar a Instancia 1 para que complete su orden
    releaseCatalog1();
    const confirmedOrder1 = await confirmPromise1;
    expect(confirmedOrder1.id).toBeDefined();

    // 8. Postgres contiene EXACTAMENTE 1 orden para la sesión, sin duplicación
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].id).toBe(confirmedOrder1.id);
  });

  it('Test 10: multi-instance concurrent addCartItem during in-flight confirmOrder does not steal reservation and preserves B in live cart', async () => {
    const sessionId = `s-u9-multi-10-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis);
    const cartRepo2 = new RedisCartRepository(redis2);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const cartUseCases1 = new CartUseCases(cartRepo1, paymentRepo, sessionService);
    const cartUseCases2 = new CartUseCases(
      cartRepo2,
      paymentRepo2,
      sessionService,
      orderRepo2,
      txCoordinator2
    );

    // 1. Sembrar A (qty 2) en el carrito
    await cartUseCases1.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-multi-10-A',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto A',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    // 2. Barrera determinista en catálogo para Instancia 1
    let releaseCatalog1!: () => void;
    const catalogBarrier1 = new Promise<void>((resolve) => {
      releaseCatalog1 = resolve;
    });

    let catalogEnteredResolve1!: () => void;
    const catalogEntered1 = new Promise<void>((resolve) => {
      catalogEnteredResolve1 = resolve;
    });

    const slowCatalog1: CatalogValidationPort = {
      getOrderableProducts: async (_t, productIds) => {
        catalogEnteredResolve1();
        await catalogBarrier1;
        return productIds.map((pid) => ({
          productId: pid,
          name: `Prod-${pid}`,
          price: 15.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases1 = new OrderUseCases(
      orderRepo,
      cartRepo1,
      slowCatalog1,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    // 3. Iniciar confirmOrder en Instancia 1
    const confirmPromise1 = orderUseCases1.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await catalogEntered1;

    // 4. Instancia 2 añade plato B al carrito en otro proceso (sin memoria compartida)
    const { clearInFlightOperations } = await import('../src/application/ports/CartReservationPort');
    clearInFlightOperations();

    await cartUseCases2.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-multi-10-B',
      quantity: 3,
      modifiers: [],
      display: {
        productName: 'Producto B',
        unitPrice: 10.0,
        modifierNames: [],
      },
    });

    // 5. Liberar a Instancia 1
    releaseCatalog1();
    const confirmedOrder1 = await confirmPromise1;
    expect(confirmedOrder1.id).toBeDefined();

    // 6. La orden de Instancia 1 solo contiene plato A (qty 2)
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].items).toHaveLength(1);
    expect(ordersInDb[0].items[0].productId).toBe('prod-multi-10-A');
    expect(ordersInDb[0].items[0].quantity).toBe(2);

    // 7. El carrito vivo en Redis contiene intacto el plato B (qty 3)
    const liveCart = await cartRepo2.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(1);
    expect(liveCart.items[0].productId).toBe('prod-multi-10-B');
    expect(liveCart.items[0].quantity).toBe(3);
  });

  it('Test 11: multi-instance deterministic orphan recovery after pre-commit crash without losing additions B or duplicating orders', async () => {
    const sessionId = `s-u9-multi-11-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis);
    const cartRepo2 = new RedisCartRepository(redis2);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const cartUseCases1 = new CartUseCases(cartRepo1, paymentRepo, sessionService);
    const cartUseCases2 = new CartUseCases(
      cartRepo2,
      paymentRepo2,
      sessionService,
      orderRepo2,
      txCoordinator2
    );

    const orderUseCases2 = new OrderUseCases(
      orderRepo2,
      cartRepo2,
      catalogValidation,
      undefined,
      paymentRepo2,
      sessionService,
      txCoordinator2
    );

    // 1. Sembrar A en el carrito
    await cartUseCases1.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-multi-11-A',
      quantity: 2,
      modifiers: [],
      display: {
        productName: 'Producto A',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    // 2. Instancia 1 reserva el carrito para confirmación
    const opId1 = `op-multi-11-${Date.now()}`;
    const ordId1 = `ord-multi-11-${Date.now()}`;
    const resResult = await cartRepo1.reserveCart(tenantId, sessionId, opId1, ordId1, 7200);
    expect(resResult.status).toBe('RESERVED');

    // 3. Mientras está reservado, un cliente añade B al carrito vivo
    await cartRepo2.addItemAtomic(
      tenantId,
      sessionId,
      'prod-multi-11-B::',
      {
        cartItemId: 'ci-multi-11-b',
        productId: 'prod-multi-11-B',
        productName: 'Producto B',
        unitPrice: 10.0,
        modifiers: [],
        quantity: 3,
        lineTotal: 30.0,
        addedAt: new Date().toISOString(),
      },
      3,
      99,
      7200
    );

    // 4. Instancia 1 sufre un crash PRE-commit:
    // Simular que el lease de Instancia 1 expira o es liberado en Redis, y el proceso muere
    // sin guardar orden en Postgres y sin ack ni restore
    if (typeof (cartRepo1 as any).releaseReservationLease === 'function') {
      await (cartRepo1 as any).releaseReservationLease(tenantId, sessionId, opId1);
    } else {
      await redis.del(`cart:reservation:lease:${tenantId}:${sessionId}:${opId1}`);
    }

    // 5. Instancia 2 ejecuta confirmOrder en la misma sesión
    const confirmedOrder2 = await orderUseCases2.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 6. Instancia 2 recuperó la reserva huérfana, la fusionó con B, y creó 1 sola orden con A y B
    expect(confirmedOrder2.id).toBeDefined();
    const ordersInDb = await orderRepo2.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].id).toBe(confirmedOrder2.id);

    const items = ordersInDb[0].items;
    expect(items).toHaveLength(2);
    const itemA = items.find((i) => i.productId === 'prod-multi-11-A');
    const itemB = items.find((i) => i.productId === 'prod-multi-11-B');
    expect(itemA?.quantity).toBe(2);
    expect(itemB?.quantity).toBe(3);

    // 7. La reserva fue procesada y el carrito quedó limpio
    const pendingRes = await cartRepo2.findReservation(tenantId, sessionId);
    expect(pendingRes).toBeNull();
    const liveCart = await cartRepo2.get(tenantId, sessionId, 7200);
    expect(liveCart.items).toHaveLength(0);
  });

  it('Test 12: multi-instance post-commit crash before ack is idempotently resolved by second instance without duplicating orders', async () => {
    const sessionId = `s-u9-multi-12-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis);
    const cartRepo2 = new RedisCartRepository(redis2);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const orderUseCases2 = new OrderUseCases(
      orderRepo2,
      cartRepo2,
      catalogValidation,
      undefined,
      paymentRepo2,
      sessionService,
      txCoordinator2
    );

    // 1. Simular reserva activa de Instancia 1
    const opId1 = `op-multi-12-${Date.now()}`;
    const ordId1 = `ord-multi-12-${Date.now()}`;
    await cartRepo1.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-multi-12-a',
        productId: 'prod-multi-12-A',
        productName: 'Producto A',
        unitPrice: 20.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 20.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );
    await cartRepo1.reserveCart(tenantId, sessionId, opId1, ordId1, 7200);

    // 2. Instancia 1 persistió la orden en Postgres con éxito
    const committedOrder = await orderRepo.save(tenantId, {
      id: ordId1,
      tenantId,
      sessionId,
      tableId,
      status: 'PLACED',
      total: 20.0,
      items: [
        {
          id: 'ci-multi-12-a',
          productId: 'prod-multi-12-A',
          productName: 'Producto A',
          unitPrice: 20.0,
          quantity: 1,
          modifiers: [],
        },
      ],
      createdAt: new Date().toISOString(),
    });

    // 3. Instancia 1 crashea POST-commit antes de ackReservation (lease expira)
    if (typeof (cartRepo1 as any).releaseReservationLease === 'function') {
      await (cartRepo1 as any).releaseReservationLease(tenantId, sessionId, opId1);
    } else {
      await redis.del(`cart:reservation:lease:${tenantId}:${sessionId}:${opId1}`);
    }

    // 4. Instancia 2 ejecuta confirmOrder
    const recoveredOrder = await orderUseCases2.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    // 5. Instancia 2 devuelve la orden existente sin crear una orden duplicada
    expect(recoveredOrder.id).toBe(committedOrder.id);
    const ordersInDb = await orderRepo2.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);

    // 6. La reserva en Redis fue acked
    const pendingRes = await cartRepo2.findReservation(tenantId, sessionId);
    expect(pendingRes).toBeNull();
  });

  it('Test 13: multi-instance orphan recovery conflict exceeding 99 rejects with CartBusyError and preserves both reservation and live cart', async () => {
    const sessionId = `s-u9-multi-13-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis);
    const cartRepo2 = new RedisCartRepository(redis2);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const cartUseCases2 = new CartUseCases(
      cartRepo2,
      paymentRepo2,
      sessionService,
      orderRepo2,
      txCoordinator2
    );

    // 1. Sembrar 60 unidades en carrito y reservar
    const opId1 = `op-multi-13-${Date.now()}`;
    const ordId1 = `ord-multi-13-${Date.now()}`;
    await cartRepo1.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-multi-13-res',
        productId: 'prod-multi-13-same',
        productName: 'Producto 13',
        unitPrice: 10.0,
        modifiers: [],
        quantity: 60,
        lineTotal: 600.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );
    await cartRepo1.reserveCart(tenantId, sessionId, opId1, ordId1, 7200);

    // 2. En el carrito vivo se sembraron 50 unidades de la misma línea canónica
    await cartRepo2.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-multi-13-live',
        productId: 'prod-multi-13-same',
        productName: 'Producto 13',
        unitPrice: 10.0,
        modifiers: [],
        quantity: 50,
        lineTotal: 500.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 3. Lease expira (crash pre-commit)
    if (typeof (cartRepo1 as any).releaseReservationLease === 'function') {
      await (cartRepo1 as any).releaseReservationLease(tenantId, sessionId, opId1);
    } else {
      await redis.del(`cart:reservation:lease:${tenantId}:${sessionId}:${opId1}`);
    }

    // 4. Instancia 2 intenta addCartItem de otro producto -> intenta recuperar reserva huérfana
    // Debe fallar con CartBusyError por conflicto (>99)
    await expect(
      cartUseCases2.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-multi-13-other',
        quantity: 1,
        modifiers: [],
        display: {
          productName: 'Otro Producto',
          unitPrice: 5.0,
          modifierNames: [],
        },
      })
    ).rejects.toThrow(CartBusyError);

    // 5. Ni la reserva (60) ni el carrito vivo (50) fueron truncados ni destruidos
    const preservedRes = await cartRepo2.findReservation(tenantId, sessionId);
    expect(preservedRes).not.toBeNull();
    expect(preservedRes!.items[0].quantity).toBe(60);

    const preservedLive = await cartRepo2.get(tenantId, sessionId, 7200);
    expect(preservedLive.items[0].quantity).toBe(50);
  });

  it('Test 14 (U9-R7): paused owner resuming after lease expiration is fenced in Postgres without creating duplicate orders or emitting events', async () => {
    const sessionId = `s-u9-multi-14-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis, { leaseTtlMs: 60 });
    const cartRepo2 = new RedisCartRepository(redis2, { leaseTtlMs: 60 });

    const orderRepo1 = new PrismaOrderRepository(prisma);
    const paymentRepo1 = new PrismaPaymentRepository(prisma);
    const txCoordinator1 = new PrismaTransactionCoordinator(prisma);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const publishedEvents1: any[] = [];
    const eventPublisher1: EventPublisher = {
      publishOrderEvent: async (_tenant, event) => {
        publishedEvents1.push(event);
      },
      publishServiceCallEvent: async () => {},
      publishCheckoutCompleted: async () => {},
    };

    const publishedEvents2: any[] = [];
    const eventPublisher2: EventPublisher = {
      publishOrderEvent: async (_tenant, event) => {
        publishedEvents2.push(event);
      },
      publishServiceCallEvent: async () => {},
      publishCheckoutCompleted: async () => {},
    };

    let pauseResolver!: () => void;
    const pausedPromise = new Promise<void>((res) => {
      pauseResolver = res;
    });
    let resumeResolver!: () => void;
    const resumePromise = new Promise<void>((res) => {
      resumeResolver = res;
    });

    let pauseRenewals = true;
    const origRefresh = cartRepo1.refreshReservationLease.bind(cartRepo1);
    jest.spyOn(cartRepo1, 'refreshReservationLease').mockImplementation(async (t, s, o) => {
      if (pauseRenewals) {
        return false;
      }
      return origRefresh(t, s, o);
    });

    const delayedCatalogValidation: CatalogValidationPort = {
      getOrderableProducts: async (t, pids) => {
        const prods = await catalogValidation.getOrderableProducts(t, pids);
        pauseResolver();
        await resumePromise;
        return prods;
      },
    };

    const orderUseCases1 = new OrderUseCases(
      orderRepo1,
      cartRepo1,
      delayedCatalogValidation,
      eventPublisher1,
      paymentRepo1,
      sessionService,
      txCoordinator1
    );

    const cartUseCases2 = new CartUseCases(
      cartRepo2,
      paymentRepo2,
      sessionService,
      orderRepo2,
      txCoordinator2
    );

    const orderUseCases2 = new OrderUseCases(
      orderRepo2,
      cartRepo2,
      catalogValidation,
      eventPublisher2,
      paymentRepo2,
      sessionService,
      txCoordinator2
    );

    // 1. Instancia 1 agrega el plato A (qty 2)
    await cartRepo1.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-multi-14-a',
        productId: 'prod-multi-14-A',
        productName: 'Producto A',
        unitPrice: 20.0,
        modifiers: [],
        quantity: 2,
        lineTotal: 40.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 2. Instancia 1 inicia confirmOrder de forma asíncrona y se pausa en catálogo
    const instance1Promise = orderUseCases1.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await pausedPromise;

    // 3. Verificar que Instancia 1 reservó el carrito con op1 y esperar que su lease expire en Redis
    const pendingRes1 = await cartRepo2.findReservation(tenantId, sessionId);
    expect(pendingRes1).not.toBeNull();
    const op1 = pendingRes1!.operationId;

    // Esperar a que el lease de 60ms expire en Redis
    let leaseActive = true;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 20));
      leaseActive = await cartRepo2.isReservationLeaseActive(tenantId, sessionId, op1);
      if (!leaseActive) break;
    }
    expect(leaseActive).toBe(false);

    // 4. Mientras Instancia 1 sigue pausada, un cliente en Instancia 2 añade el plato B
    // Instancia 2 detecta el lease expirado, recupera y restaura A, y añade B
    await cartUseCases2.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-multi-14-B',
      quantity: 1,
      modifiers: [],
      display: {
        productName: 'Producto B',
        unitPrice: 15.0,
        modifierNames: [],
      },
    });

    // 5. Instancia 2 confirma la orden con A + B
    const confirmedOrder2 = await orderUseCases2.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    expect(confirmedOrder2.id).toBeDefined();
    expect(publishedEvents2).toHaveLength(1);
    expect(publishedEvents2[0].order.id).toBe(confirmedOrder2.id);

    // 6. Ahora Instancia 1 (owner original) reanuda su ejecución tras la pausa
    // e intenta entrar a runInSessionLock y guardar su snapshot obsoleto ord1
    resumeResolver();

    // Debe ser bloqueado por el fencing transaccional de Postgres
    await expect(instance1Promise).rejects.toThrow(CartBusyError);

    // 7. Verificación en Postgres: exactamente 1 orden existe (ord2 con A + B)
    const ordersInDb = await orderRepo2.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].id).toBe(confirmedOrder2.id);
    expect(ordersInDb[0].items).toHaveLength(2);

    // 8. Instancia 1 no emitió ningún evento order.created
    expect(publishedEvents1).toHaveLength(0);
  });

  it('Test 15 (U9-R7): failed Redis lease renewal with live owner triggers fencing and prevents duplicate orders', async () => {
    const sessionId = `s-u9-multi-15-${Date.now()}`;
    const cartRepo1 = new RedisCartRepository(redis, { leaseTtlMs: 60 });
    const cartRepo2 = new RedisCartRepository(redis2, { leaseTtlMs: 60 });

    const orderRepo1 = new PrismaOrderRepository(prisma);
    const paymentRepo1 = new PrismaPaymentRepository(prisma);
    const txCoordinator1 = new PrismaTransactionCoordinator(prisma);

    const orderRepo2 = new PrismaOrderRepository(prisma);
    const paymentRepo2 = new PrismaPaymentRepository(prisma);
    const txCoordinator2 = new PrismaTransactionCoordinator(prisma);

    const publishedEvents1: any[] = [];
    const eventPublisher1: EventPublisher = {
      publishOrderEvent: async (_tenant, event) => {
        publishedEvents1.push(event);
      },
      publishServiceCallEvent: async () => {},
      publishCheckoutCompleted: async () => {},
    };

    let pauseResolver!: () => void;
    const pausedPromise = new Promise<void>((res) => {
      pauseResolver = res;
    });
    let resumeResolver!: () => void;
    const resumePromise = new Promise<void>((res) => {
      resumeResolver = res;
    });

    let pauseRenewals = true;
    const origRefresh = cartRepo1.refreshReservationLease.bind(cartRepo1);
    jest.spyOn(cartRepo1, 'refreshReservationLease').mockImplementation(async (t, s, o) => {
      if (pauseRenewals) {
        return false;
      }
      return origRefresh(t, s, o);
    });

    const delayedCatalogValidation: CatalogValidationPort = {
      getOrderableProducts: async (t, pids) => {
        const prods = await catalogValidation.getOrderableProducts(t, pids);
        pauseResolver();
        await resumePromise;
        return prods;
      },
    };

    // Simular que la renovación del lease en Redis falla (devuelve false como si la key hubiese expirado/fallado)
    jest.spyOn(cartRepo1, 'refreshReservationLease').mockResolvedValue(false);

    const orderUseCases1 = new OrderUseCases(
      orderRepo1,
      cartRepo1,
      delayedCatalogValidation,
      eventPublisher1,
      paymentRepo1,
      sessionService,
      txCoordinator1
    );

    const orderUseCases2 = new OrderUseCases(
      orderRepo2,
      cartRepo2,
      catalogValidation,
      undefined,
      paymentRepo2,
      sessionService,
      txCoordinator2
    );

    // 1. Instancia 1 añade plato X
    await cartRepo1.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-multi-15-x',
        productId: 'prod-multi-15-X',
        productName: 'Producto X',
        unitPrice: 30.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 30.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 2. Instancia 1 inicia confirmOrder y se pausa en catálogo
    const instance1Promise = orderUseCases1.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    await pausedPromise;

    // 3. Esperar que el lease de 60ms venza
    await new Promise((r) => setTimeout(r, 100));

    // 4. Instancia 2 recupera la reserva huérfana y confirma la orden
    const confirmedOrder2 = await orderUseCases2.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });
    expect(confirmedOrder2.id).toBeDefined();

    // 5. Instancia 1 reanuda después de su catálogo
    resumeResolver();

    // 6. Instancia 1 es rechazada por el fencing en Postgres
    await expect(instance1Promise).rejects.toThrow(CartBusyError);

    // 7. En Postgres sólo existe 1 orden (la de Instancia 2)
    const ordersInDb = await orderRepo2.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(1);
    expect(ordersInDb[0].id).toBe(confirmedOrder2.id);

    // 8. Instancia 1 no emitió evento
    expect(publishedEvents1).toHaveLength(0);
  });
});
