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

describe('R02 - Validación en Ordering (Contract Tests)', () => {
  let app: any;
  const tenantId = 't-val-test';
  const sessionId = 's-val-test';
  const headers = {
    'x-tenant-id': tenantId,
    'x-session-id': sessionId,
    'x-user-id': 'u-val-test',
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
        productId: 'prod-valid',
        name: 'Plato Valido',
        price: 15,
        isAvailable: true,
        modifierGroups: [],
      },
      {
        productId: 'prod-unavailable',
        name: 'Plato Agotado',
        price: 15,
        isAvailable: false,
        modifierGroups: [],
      },
    ];

    const serviceCallRepo = new RedisServiceCallRepository(redis);
    const eventPublisher = new RedisEventPublisher(redis);
    const sessionService = new InMemorySessionServiceAdapter();
    sessionService.setSession({
      tenantId,
      sessionId,
      tableId: 't-1',
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

  describe('POST /cart/items - Validación de cantidad (1..99 entero)', () => {
    it('debe rechazar cantidad negativa (-1) con HTTP 400 VALIDATION_ERROR y no alterar el carrito', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: -1,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');

      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.status).toBe(200);
      expect(cartRes.body.items).toHaveLength(0);
    });

    it('debe rechazar cantidad fraccionaria (1.5) con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 1.5,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe rechazar cantidad cero (0) con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 0,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe rechazar cantidad mayor a 99 (100) con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 100,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe rechazar string no numérico con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 'invalido',
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe aceptar cantidad válida (5) con HTTP 201', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 5,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('al acumular/mergear en línea existente, si la suma supera 99 debe lanzar VALIDATION_ERROR', async () => {
      // Primero añadimos 60
      const res1 = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 60,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });
      expect(res1.status).toBe(201);

      // Intentamos añadir 40 (60 + 40 = 100 > 99)
      const res2 = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 40,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error?.code).toBe('VALIDATION_ERROR');

      // Carrito debe mantener la cantidad previa (60)
      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.body.items[0].quantity).toBe(60);
    });

    it('debe rechazar producto con isAvailable=false con HTTP 409 PRODUCT_UNAVAILABLE', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-unavailable',
          quantity: 1,
          display: { productName: 'Plato Agotado', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('PRODUCT_UNAVAILABLE');

      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.body.items).toHaveLength(0);
    });
  });

  describe('PATCH /cart/items/:id - Validación de cantidad', () => {
    let cartItemId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-valid',
          quantity: 2,
          display: { productName: 'Plato', unitPrice: 15, modifierNames: [] },
        });
      cartItemId = res.body.items[0].cartItemId;
    });

    it('debe rechazar cantidad negativa (-1) con HTTP 400 VALIDATION_ERROR y no alterar el carrito', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');

      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.body.items[0].quantity).toBe(2);
    });

    it('debe rechazar cantidad fraccionaria (2.5) con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe rechazar cantidad 0 con HTTP 400 VALIDATION_ERROR (eliminar se hace con DELETE)', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');

      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.body.items[0].quantity).toBe(2);
    });

    it('debe rechazar cantidad mayor a 99 (100) con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe rechazar string no numérico con HTTP 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 'tres' });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('debe aceptar actualización válida (10) con HTTP 200', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(10);
    });
  });

  describe('CHECK Constraints en PostgreSQL (Ordering)', () => {
    it('debe rechazar OrderItem con quantity <= 0 o > 99 a nivel base de datos', async () => {
      const prisma = getTestPrisma();
      const order = await prisma.order.create({
        data: {
          tenantId,
          sessionId,
          tableId: 't-1',
          total: 10,
        },
      });

      await expect(
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: 'p-1',
            productName: 'P',
            unitPrice: 10,
            quantity: 0,
          },
        })
      ).rejects.toThrow();

      await expect(
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: 'p-1',
            productName: 'P',
            unitPrice: 10,
            quantity: 100,
          },
        })
      ).rejects.toThrow();
    });

    it('debe rechazar Order con total negativo a nivel base de datos', async () => {
      const prisma = getTestPrisma();
      await expect(
        prisma.order.create({
          data: {
            tenantId,
            sessionId,
            tableId: 't-1',
            total: -1,
          },
        })
      ).rejects.toThrow();
    });

    it('debe rechazar Payment con amount negativo a nivel base de datos', async () => {
      const prisma = getTestPrisma();
      await expect(
        prisma.payment.create({
          data: {
            tenantId,
            sessionId,
            tableId: 't-1',
            amount: -10,
            method: 'CASH',
            ordersCount: 1,
            recordedBy: 'user-1',
          },
        })
      ).rejects.toThrow();
    });
  });
});
