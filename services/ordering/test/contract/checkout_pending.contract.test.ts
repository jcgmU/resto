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
import { RedisServiceCallRepository } from '../../src/infrastructure/persistence/RedisServiceCallRepository';
import { RedisEventPublisher } from '../../src/infrastructure/events/RedisEventPublisher';
import {
  InMemoryCatalogValidationAdapter,
  InMemorySessionServiceAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { TableSessionDTO } from '@packages/shared-types';

describe('Contract - Checkout con órdenes sin entregar (ADR D2)', () => {
  let app: any;
  let sessionService: InMemorySessionServiceAdapter;
  let redisSub: any;
  const tenantId = 'tenant-d2-test';
  const tableId = 'mesa-d2-1';

  beforeAll(async () => {
    await ensureContractEnv();
    const redis = getTestRedis();
    const prisma = getTestPrisma();

    const cartRepo = new RedisCartRepository(redis);
    const orderRepo = new PrismaOrderRepository(prisma);
    const paymentRepo = new PrismaPaymentRepository(prisma);
    const serviceCallRepo = new RedisServiceCallRepository(redis);
    const eventPublisher = new RedisEventPublisher(redis);
    const catalogValidation = new InMemoryCatalogValidationAdapter();

    sessionService = new InMemorySessionServiceAdapter({ autoCreateActive: false });

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
    sessionService.sessions.clear();
    sessionService.closedSessions = [];
  });

  afterAll(async () => {
    if (redisSub) {
      await redisSub.quit();
    }
    await disconnectTestInfra();
  });

  function setupSession(sessionId: string): TableSessionDTO {
    const session: TableSessionDTO = {
      tenantId,
      sessionId,
      tableId,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    sessionService.setSession(session);
    return session;
  }

  it('(a) PLACED sin flag -> 409 ORDERS_NOT_DELIVERED con error.details.pendingOrders correcto y sin pago creado', async () => {
    const sessionId = 'sess-placed-no-flag';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    const order = await prisma.order.create({
      data: {
        id: 'ord-placed-contract',
        tenantId,
        sessionId,
        tableId,
        status: 'PLACED',
        kitchenStatus: 'PLACED',
        total: 55,
        items: {
          create: [
            {
              id: 'it-1',
              productId: 'p-1',
              productName: 'Hamburguesa',
              unitPrice: 27.5,
              quantity: 2,
              destination: 'kitchen',
            },
          ],
        },
      },
    });

    const res = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('ORDERS_NOT_DELIVERED');
    expect(res.body.error.details).toBeDefined();
    expect(res.body.error.details.pendingOrders).toHaveLength(1);
    expect(res.body.error.details.pendingOrders[0]).toMatchObject({
      orderId: order.id,
      tableId,
      status: 'PLACED',
      kitchenStatus: 'PLACED',
      itemsCount: 2,
    });

    // Cero pagos en DB
    const payments = await prisma.payment.findMany({ where: { tenantId, sessionId } });
    expect(payments).toHaveLength(0);
  });

  it('(b) READY + closePendingOrders: true + manager -> 201 y orden queda en CANCELLED con cancelReason checkout y kitchenStatus CANCELLED', async () => {
    const sessionId = 'sess-ready-flag-mgr';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-ready-contract',
        tenantId,
        sessionId,
        tableId,
        status: 'READY',
        kitchenStatus: 'READY',
        barStatus: null,
        total: 40,
        items: {
          create: [
            {
              id: 'it-ready',
              productId: 'p-ready',
              productName: 'Pasta',
              unitPrice: 40,
              quantity: 1,
              destination: 'kitchen',
            },
          ],
        },
      },
    });

    const res = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'manager-1',
        'x-user-role': 'manager',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.amount).toBe(40);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: 'ord-ready-contract' },
    });
    expect(updatedOrder?.status).toBe('CANCELLED');
    expect(updatedOrder?.cancelReason).toBe('checkout');
    expect(updatedOrder?.kitchenStatus).toBe('CANCELLED');
    expect(updatedOrder?.barStatus).toBeNull();
    expect(updatedOrder?.cancelledAt).not.toBeNull();
  });

  it('(c) closePendingOrders: true + cashier -> 403 y nada cambia (ni pago creado ni orden cancelada)', async () => {
    const sessionId = 'sess-cashier-flag';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-cashier-test',
        tenantId,
        sessionId,
        tableId,
        status: 'IN_KITCHEN',
        kitchenStatus: 'IN_KITCHEN',
        total: 35,
        items: {
          create: [
            {
              id: 'it-c',
              productId: 'p-c',
              productName: 'Ensalada',
              unitPrice: 35,
              quantity: 1,
              destination: 'kitchen',
            },
          ],
        },
      },
    });

    const res = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'cashier-1',
        'x-user-role': 'cashier',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const payments = await prisma.payment.findMany({ where: { tenantId, sessionId } });
    expect(payments).toHaveLength(0);

    const order = await prisma.order.findUnique({ where: { id: 'ord-cashier-test' } });
    expect(order?.status).toBe('IN_KITCHEN');
    expect(order?.cancelReason).toBeNull();
  });

  it('(d) closePendingOrders: true + staff -> 403', async () => {
    const sessionId = 'sess-staff-flag';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-staff-test',
        tenantId,
        sessionId,
        tableId,
        status: 'PLACED',
        total: 20,
      },
    });

    const res = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-1',
        'x-user-role': 'staff',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('(e) Todo DELIVERED -> 201 sin flag', async () => {
    const sessionId = 'sess-delivered-ok';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-deliv-test',
        tenantId,
        sessionId,
        tableId,
        status: 'DELIVERED',
        kitchenStatus: 'DELIVERED',
        total: 50,
      },
    });

    const res = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-1',
        'x-user-role': 'staff',
      })
      .send({
        sessionId,
        tableId,
        method: 'CARD',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(50);
  });

  it('(f) Reintento con pago existente -> 200 con el mismo total (no evalúa 409)', async () => {
    const sessionId = 'sess-retry-idempotent';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-retry-test',
        tenantId,
        sessionId,
        tableId,
        status: 'DELIVERED',
        total: 60,
      },
    });

    const first = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-1',
        'x-user-role': 'staff',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-1',
        'x-user-role': 'staff',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
      });
    expect(second.status).toBe(200);
    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(second.body.payment.amount).toBe(60);
  });

  it('(g) GetBill después del cierre con closePendingOrders: true = monto del pago', async () => {
    const sessionId = 'sess-getbill-check';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-getbill-test',
        tenantId,
        sessionId,
        tableId,
        status: 'READY',
        kitchenStatus: 'READY',
        total: 80,
      },
    });

    const checkoutRes = await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      })
      .send({
        sessionId,
        tableId,
        method: 'CARD',
        closePendingOrders: true,
      });
    expect(checkoutRes.status).toBe(201);

    const billRes = await request(app)
      .get(`/checkout/${sessionId}`)
      .set({
        'x-tenant-id': tenantId,
        'x-user-role': 'admin',
      });

    expect(billRes.status).toBe(200);
    expect(billRes.body.total).toBe(checkoutRes.body.payment.amount);
    expect(billRes.body.ordersCount).toBe(1);
  });

  it('(h) GET /v1/orders/:id/history incluye el evento con reason: checkout', async () => {
    const sessionId = 'sess-history-check';
    setupSession(sessionId);

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-hist-test',
        tenantId,
        sessionId,
        tableId,
        status: 'IN_KITCHEN',
        kitchenStatus: 'IN_KITCHEN',
        total: 30,
      },
    });

    await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      });

    const histRes = await request(app)
      .get('/orders/ord-hist-test/history')
      .set({
        'x-tenant-id': tenantId,
        'x-user-role': 'admin',
      });

    expect(histRes.status).toBe(200);
    const cancelEvt = histRes.body.find((e: any) => e.toStatus === 'CANCELLED');
    expect(cancelEvt).toBeDefined();
    expect(cancelEvt.reason).toBe('checkout');
  });

  it('(i) Se publica un evento order.status-changed por cada orden cerrada', async () => {
    const sessionId = 'sess-pubsub-check';
    setupSession(sessionId);

    const redis = getTestRedis();
    redisSub = redis.duplicate();
    await redisSub.subscribe(`tenant:${tenantId}:order-events`);

    const receivedEvents: any[] = [];
    redisSub.on('message', (_channel: string, msg: string) => {
      try {
        receivedEvents.push(JSON.parse(msg));
      } catch {}
    });

    const prisma = getTestPrisma();
    await prisma.order.create({
      data: {
        id: 'ord-pubsub-test',
        tenantId,
        sessionId,
        tableId,
        status: 'IN_KITCHEN',
        kitchenStatus: 'IN_KITCHEN',
        total: 25,
      },
    });

    await request(app)
      .post('/checkout/confirm')
      .set({
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-1',
        'x-user-role': 'admin',
      })
      .send({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      });

    // Esperar mensaje en Redis
    await new Promise((r) => setTimeout(r, 200));

    const statusChanged = receivedEvents.find(
      (e) => e.type === 'order.status-changed' && e.order?.id === 'ord-pubsub-test'
    );
    expect(statusChanged).toBeDefined();
    expect(statusChanged.order.status).toBe('CANCELLED');
    expect(statusChanged.order.cancelReason).toBe('checkout');
    expect(statusChanged.previousStatus).toBe('IN_KITCHEN');
  });
});
