import request from 'supertest';
import {
  ensureContractEnv,
  getTestPrisma,
  getTestRedis,
  truncateOrderingDb,
  flushOrderingRedis,
  disconnectTestInfra,
} from './contract-helper';
import { createOrderingApp } from '../../src/app';
import { RedisCartRepository } from '../../src/infrastructure/persistence/RedisCartRepository';
import { PrismaOrderRepository } from '../../src/infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from '../../src/infrastructure/persistence/PrismaPaymentRepository';
import {
  InMemoryCatalogValidationAdapter,
  InMemorySessionServiceAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { RedisServiceCallRepository } from '../../src/infrastructure/persistence/RedisServiceCallRepository';
import { RedisEventPublisher } from '../../src/infrastructure/events/RedisEventPublisher';

describe('R05 - Concurrencia Atómica en Carrito (Contract Tests)', () => {
  let app: any;
  const tenantId = 't-cart-conc';
  const sessionId = 's-cart-conc';
  const headers = {
    'x-tenant-id': tenantId,
    'x-session-id': sessionId,
    'x-user-id': 'u-cart-conc',
  };

  beforeAll(async () => {
    await ensureContractEnv();
    const redis = getTestRedis();
    const prisma = getTestPrisma();
    const cartRepo = new RedisCartRepository(redis);
    const orderRepo = new PrismaOrderRepository(prisma);
    const paymentRepo = new PrismaPaymentRepository(prisma);
    const catalogValidation = new InMemoryCatalogValidationAdapter();
    catalogValidation.products = [
      {
        productId: 'prod-concurrency-1',
        name: 'Hamburguesa Concurrente',
        price: 20,
        isAvailable: true,
        modifierGroups: [
          {
            groupId: 'g1',
            name: 'Salsas',
            minSelections: 0,
            maxSelections: 2,
            isRequired: false,
            options: [
              { optionId: 'o1', name: 'BBQ', priceDelta: 2 },
            ],
          },
        ],
      },
    ];

    const serviceCallRepo = new RedisServiceCallRepository(redis);
    const eventPublisher = new RedisEventPublisher(redis);
    const sessionService = new InMemorySessionServiceAdapter();
    sessionService.setSession({
      tenantId,
      sessionId,
      tableId: 't-conc-1',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    app = createOrderingApp({
      cartRepo,
      orderRepo,
      paymentRepo,
      catalogValidation,
      serviceCallRepo,
      eventPublisher,
      sessionService,
    });
  });

  beforeEach(async () => {
    await flushOrderingRedis();
    await truncateOrderingDb();
  });

  afterAll(async () => {
    await disconnectTestInfra();
  });

  it('8 adiciones concurrentes sobre cantidad 1 deben converger exactamente en cantidad 9 y totales correctos', async () => {
    const itemPayload = {
      productId: 'prod-concurrency-1',
      quantity: 1,
      modifiers: [{ groupId: 'g1', optionId: 'o1' }],
      display: {
        productName: 'Hamburguesa Concurrente',
        unitPrice: 20,
        modifierNames: [{ groupName: 'Salsas', optionName: 'BBQ', priceDelta: 2 }],
      },
    };

    // 1. Estado inicial: carrito con 1 ítem (quantity = 1)
    const initRes = await request(app)
      .post('/cart/items')
      .set(headers)
      .send(itemPayload);

    expect(initRes.status).toBe(201);
    expect(initRes.body.items).toHaveLength(1);
    expect(initRes.body.items[0].quantity).toBe(1);
    expect(initRes.body.items[0].lineTotal).toBe(22);
    expect(initRes.body.total).toBe(22);

    // 2. Ejecutar 8 llamadas concurrentes agregando 1 unidad del mismo producto con mismos modificadores
    const concurrentCalls = Array.from({ length: 8 }).map(() =>
      request(app)
        .post('/cart/items')
        .set(headers)
        .send(itemPayload)
    );

    const responses = await Promise.all(concurrentCalls);
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    // 3. Inspeccionar el estado final del carrito en Redis
    const finalCartRes = await request(app).get('/cart').set(headers);
    expect(finalCartRes.status).toBe(200);
    expect(finalCartRes.body.items).toHaveLength(1);

    // Debe ser 9 (1 inicial + 8 concurrentes)
    expect(finalCartRes.body.items[0].quantity).toBe(9);
    // (20 unitPrice + 2 modifierDelta) * 9 = 198
    expect(finalCartRes.body.items[0].lineTotal).toBe(198);
    expect(finalCartRes.body.total).toBe(198);
  });

  it('dos confirmaciones de orden concurrentes (doble confirmación) deben permitir solo 1 orden y la otra fallar con CART_EMPTY', async () => {
    // 1. Preparar carrito con 1 ítem
    await request(app)
      .post('/cart/items')
      .set(headers)
      .send({
        productId: 'prod-concurrency-1',
        quantity: 2,
        modifiers: [{ groupId: 'g1', optionId: 'o1' }],
        display: {
          productName: 'Hamburguesa Concurrente',
          unitPrice: 20,
          modifierNames: [{ groupName: 'Salsas', optionName: 'BBQ', priceDelta: 2 }],
        },
      });

    // 2. Dos confirmaciones simultáneas para la misma sesión
    const [resA, resB] = await Promise.all([
      request(app).post('/cart/confirm').set(headers).send({ tableId: 't-conc-1' }),
      request(app).post('/cart/confirm').set(headers).send({ tableId: 't-conc-1' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Una debe ser 201 (éxito) y la otra 400 (CART_EMPTY)
    expect(statuses).toEqual([201, 400]);

    const failedRes = resA.status === 400 ? resA : resB;
    expect(failedRes.body.error?.code).toBe('CART_EMPTY');

    // 3. Verificar en PostgreSQL que se guardó exactamente 1 orden
    const prisma = getTestPrisma();
    const orders = await prisma.order.findMany({
      where: { tenantId, sessionId },
    });
    expect(orders).toHaveLength(1);
    expect(Number(orders[0].total)).toBe(44); // (20 + 2) * 2

    // 4. Carrito en Redis debe haber quedado vacío
    const cartRes = await request(app).get('/cart').set(headers);
    expect(cartRes.body.items).toHaveLength(0);
    expect(cartRes.body.total).toBe(0);
  });
});
