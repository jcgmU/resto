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
  InMemoryIdentitySettingsAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { RedisServiceCallRepository } from '../../src/infrastructure/persistence/RedisServiceCallRepository';
import { RedisEventPublisher } from '../../src/infrastructure/events/RedisEventPublisher';
import { computeOrderOverdue } from '@packages/shared-types';

describe('V17 - Ordering Notas, SLA, Demora e Historial (Contract Tests PostgreSQL Real)', () => {
  let app: any;
  const tenantId = 't-sla-history-test';
  const sessionId = 's-sla-history-test';
  const guestHeaders = {
    'x-tenant-id': tenantId,
    'x-session-id': sessionId,
    'x-user-id': 'u-guest-1',
    'x-user-role': 'guest',
  };
  const staffHeaders = {
    'x-tenant-id': tenantId,
    'x-user-id': 'u-staff-1',
    'x-user-role': 'staff',
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
        productId: 'prod-sla-1',
        name: 'Hamburguesa Especial',
        price: 25000,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    const serviceCallRepo = new RedisServiceCallRepository(redis);
    const eventPublisher = new RedisEventPublisher(redis);
    const sessionService = new InMemorySessionServiceAdapter();
    sessionService.setSession({
      tenantId,
      sessionId,
      tableId: 'mesa-sla-1',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    const identitySettings = new InMemoryIdentitySettingsAdapter();
    identitySettings.setEstimatedPrepMinutes(tenantId, 20);

    app = createOrderingApp({
      cartRepo,
      orderRepo,
      paymentRepo,
      catalogValidation,
      serviceCallRepo,
      eventPublisher,
      sessionService,
      identitySettings,
    });
  });

  beforeEach(async () => {
    await truncateOrderingDb();
    await flushOrderingRedis();
  });

  afterAll(async () => {
    await disconnectTestInfra();
  });

  describe('1. Notas por ítem y notas generales', () => {
    it('persiste notas por ítem y notas generales en PostgreSQL real y las retorna en el DTO', async () => {
      // 1. Agregar ítem al carrito con notas específicas
      const addRes = await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-sla-1',
          quantity: 2,
          notes: 'Sin cebolla y término medio',
        });
      expect(addRes.status).toBe(201);
      expect(addRes.body.items[0].notes).toBe('Sin cebolla y término medio');

      // 2. Confirmar orden con notas generales ('otras solicitudes') y estimatedMinutes
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({
          tableId: 'mesa-sla-1',
          notes: 'Mesa al lado de la ventana, traer servilletas extras',
          estimatedMinutes: 20,
        });

      expect(confirmRes.status).toBe(201);
      const createdOrder = confirmRes.body;
      expect(createdOrder.notes).toBe('Mesa al lado de la ventana, traer servilletas extras');
      expect(createdOrder.estimatedMinutes).toBe(20);
      expect(createdOrder.delayMinutes).toBe(0);
      expect(createdOrder.overdue).toBe(false);
      expect(createdOrder.items).toHaveLength(1);
      expect(createdOrder.items[0].notes).toBe('Sin cebolla y término medio');

      // 3. Verificar directamente en PostgreSQL real
      const prisma = getTestPrisma();
      const dbOrder = await prisma.order.findUnique({
        where: { id: createdOrder.id },
        include: { items: true },
      });
      expect(dbOrder).not.toBeNull();
      expect(dbOrder?.notes).toBe('Mesa al lado de la ventana, traer servilletas extras');
      expect(dbOrder?.estimatedMinutes).toBe(20);
      expect(dbOrder?.delayMinutes).toBe(0);
      expect(dbOrder?.items[0].notes).toBe('Sin cebolla y término medio');

      // 4. GET /orders/:id devuelve los campos
      const getRes = await request(app)
        .get(`/orders/${createdOrder.id}`)
        .set(guestHeaders);
      expect(getRes.status).toBe(200);
      expect(getRes.body.notes).toBe('Mesa al lado de la ventana, traer servilletas extras');
      expect(getRes.body.estimatedMinutes).toBe(20);
      expect(getRes.body.delayMinutes).toBe(0);
      expect(getRes.body.items[0].notes).toBe('Sin cebolla y término medio');
    });

    it('rechaza notas generales mayores a 280 caracteres con 400 VALIDATION_ERROR', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-sla-1',
          quantity: 1,
        });

      const longNotes = 'A'.repeat(281);
      const res = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({
          tableId: 'mesa-sla-1',
          notes: longNotes,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Historial de transiciones (OrderStatusEvent y GET /orders/:id/history)', () => {
    it('registra evento en OrderStatusEvent en cada cambio de estado y GET /orders/:id/history lo retorna cronológicamente', async () => {
      // 1. Crear orden
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const orderId = confirmRes.body.id;

      // Al inicio, no hay transiciones previas
      const initHistoryRes = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(guestHeaders);
      expect(initHistoryRes.status).toBe(200);
      expect(initHistoryRes.body).toEqual([]);

      // 2. Transición PLACED -> IN_KITCHEN (Staff)
      const t1 = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'IN_KITCHEN' });
      expect(t1.status).toBe(200);

      const hist1 = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(guestHeaders);
      expect(hist1.status).toBe(200);
      expect(hist1.body).toHaveLength(1);
      expect(hist1.body[0].orderId).toBe(orderId);
      expect(hist1.body[0].fromStatus).toBe('PLACED');
      expect(hist1.body[0].toStatus).toBe('IN_KITCHEN');
      expect(hist1.body[0].occurredAt).toBeDefined();

      // 3. Transición IN_KITCHEN -> READY (Staff)
      const t2 = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'READY' });
      expect(t2.status).toBe(200);

      const hist2 = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(staffHeaders);
      expect(hist2.status).toBe(200);
      expect(hist2.body).toHaveLength(2);
      expect(hist2.body[0].fromStatus).toBe('PLACED');
      expect(hist2.body[0].toStatus).toBe('IN_KITCHEN');
      expect(hist2.body[1].fromStatus).toBe('IN_KITCHEN');
      expect(hist2.body[1].toStatus).toBe('READY');

      // 4. Transición READY -> DELIVERED (Staff)
      const t3 = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'DELIVERED' });
      expect(t3.status).toBe(200);

      const hist3 = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(staffHeaders);
      expect(hist3.status).toBe(200);
      expect(hist3.body).toHaveLength(3);
      expect(hist3.body[2].fromStatus).toBe('READY');
      expect(hist3.body[2].toStatus).toBe('DELIVERED');

      // 5. Verificar directamente en PostgreSQL
      const prisma = getTestPrisma();
      const eventsInDb = await prisma.orderStatusEvent.findMany({
        where: { orderId },
        orderBy: { occurredAt: 'asc' },
      });
      expect(eventsInDb).toHaveLength(3);
      expect(eventsInDb[0].fromStatus).toBe('PLACED');
      expect(eventsInDb[0].toStatus).toBe('IN_KITCHEN');
      expect(eventsInDb[1].fromStatus).toBe('IN_KITCHEN');
      expect(eventsInDb[1].toStatus).toBe('READY');
      expect(eventsInDb[2].fromStatus).toBe('READY');
      expect(eventsInDb[2].toStatus).toBe('DELIVERED');
    });

    it('restringe acceso a historial de otra mesa para guest con 403 FORBIDDEN', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const orderId = confirmRes.body.id;

      const otherGuestHeaders = {
        'x-tenant-id': tenantId,
        'x-session-id': 'session-ajena',
        'x-user-id': 'u-other-guest',
        'x-user-role': 'guest',
      };

      const res = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(otherGuestHeaders);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('registra evento en OrderStatusEvent al cancelar orden', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const orderId = confirmRes.body.id;

      const adminHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'u-admin-1',
        'x-user-role': 'admin',
      };

      const cancelRes = await request(app)
        .patch(`/orders/${orderId}/cancel`)
        .set(adminHeaders);
      expect(cancelRes.status).toBe(200);

      const histRes = await request(app)
        .get(`/orders/${orderId}/history`)
        .set(staffHeaders);
      expect(histRes.status).toBe(200);
      expect(histRes.body).toHaveLength(1);
      expect(histRes.body[0].fromStatus).toBe('PLACED');
      expect(histRes.body[0].toStatus).toBe('CANCELLED');
    });
  });

  describe('3. Asignación de demora (PATCH /orders/:id/delay)', () => {
    it('permite a staff actualizar delayMinutes con entero entre 1 y 120', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 18 });
      const orderId = confirmRes.body.id;

      const delayRes = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 12 });

      expect(delayRes.status).toBe(200);
      expect(delayRes.body.delayMinutes).toBe(12);

      // Verificar persistencia en DB
      const prisma = getTestPrisma();
      const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(dbOrder?.delayMinutes).toBe(12);

      // GET /orders/:id lo devuelve
      const getRes = await request(app)
        .get(`/orders/${orderId}`)
        .set(staffHeaders);
      expect(getRes.body.delayMinutes).toBe(12);
    });

    it('bloquea a usuarios sin rol de staff con 403 FORBIDDEN', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const orderId = confirmRes.body.id;

      const res = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(guestHeaders)
        .send({ delayMinutes: 10 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rechaza valores negativos, no enteros o inválidos con 400 VALIDATION_ERROR', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const orderId = confirmRes.body.id;

      // Negativo
      const resNeg = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: -5 });
      expect(resNeg.status).toBe(400);
      expect(resNeg.body.error.code).toBe('VALIDATION_ERROR');

      // Decimal no entero
      const resDec = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 4.5 });
      expect(resDec.status).toBe(400);
      expect(resDec.body.error.code).toBe('VALIDATION_ERROR');

      // No numérico
      const resStr = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 'diez' });
      expect(resStr.status).toBe(400);
      expect(resStr.body.error.code).toBe('VALIDATION_ERROR');

      // delayMinutes > 120 tope
      const resMax = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 121 });
      expect(resMax.status).toBe(400);
      expect(resMax.body.error.code).toBe('VALIDATION_ERROR');

      // delayMinutes < 1 (0 es menor a 1)
      const resZero = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 0 });
      expect(resZero.status).toBe(400);
      expect(resZero.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza delay en ordenes en estado terminal (DELIVERED, CANCELLED) con 409 ORDER_ALREADY_TERMINAL', async () => {
      // 1. Orden DELIVERED
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const conf1 = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const ord1Id = conf1.body.id;

      await request(app).patch(`/orders/${ord1Id}/status`).set(staffHeaders).send({ status: 'IN_KITCHEN' });
      await request(app).patch(`/orders/${ord1Id}/status`).set(staffHeaders).send({ status: 'READY' });
      await request(app).patch(`/orders/${ord1Id}/status`).set(staffHeaders).send({ status: 'DELIVERED' });

      const resDelivered = await request(app)
        .patch(`/orders/${ord1Id}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 15 });
      expect(resDelivered.status).toBe(409);
      expect(resDelivered.body.error.code).toBe('ORDER_ALREADY_TERMINAL');

      // 2. Orden CANCELLED
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const conf2 = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1' });
      const ord2Id = conf2.body.id;

      const adminHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'u-admin-1',
        'x-user-role': 'admin',
      };
      await request(app).patch(`/orders/${ord2Id}/cancel`).set(adminHeaders);

      const resCancelled = await request(app)
        .patch(`/orders/${ord2Id}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 15 });
      expect(resCancelled.status).toBe(409);
      expect(resCancelled.body.error.code).toBe('ORDER_ALREADY_TERMINAL');
    });
  });

  describe('5. U3: estimatedMinutes desde tenant + ignorar guest + clamp', () => {
    it('obtiene estimatedMinutes del tenant para guest e ignora el estimatedMinutes enviado en el body', async () => {
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });

      // Guest envía estimatedMinutes: 99, pero el tenant tiene configurado 20
      const res = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 99 });

      expect(res.status).toBe(201);
      expect(res.body.estimatedMinutes).toBe(20);
    });

    it('permite a staff hacer override de estimatedMinutes con clamp entre 5 y 120', async () => {
      // 1. Staff envía override válido dentro del clamp
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });

      const staffConfirmHeaders = {
        'x-tenant-id': tenantId,
        'x-session-id': sessionId,
        'x-user-id': 'u-staff-1',
        'x-user-role': 'staff',
      };

      const resStaff = await request(app)
        .post('/cart/confirm')
        .set(staffConfirmHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 35 });

      expect(resStaff.status).toBe(201);
      expect(resStaff.body.estimatedMinutes).toBe(35);

      // 2. Staff envía valor menor a 5 -> clamp a 5
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });

      const resLow = await request(app)
        .post('/cart/confirm')
        .set(staffConfirmHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 2 });

      expect(resLow.status).toBe(201);
      expect(resLow.body.estimatedMinutes).toBe(5);

      // 3. Staff envía valor mayor a 120 -> clamp a 120
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });

      const resHigh = await request(app)
        .post('/cart/confirm')
        .set(staffConfirmHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 150 });

      expect(resHigh.status).toBe(201);
      expect(resHigh.body.estimatedMinutes).toBe(120);
    });
  });


  describe('4. Flag computado overdue', () => {
    it('calcula overdue basado en SLA base + delayMinutes y estados activos', async () => {
      const prisma = getTestPrisma();

      // 1. Crear orden con SLA base de 15 minutos
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({ productId: 'prod-sla-1', quantity: 1 });
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-sla-1', estimatedMinutes: 15 });
      const orderId = confirmRes.body.id;

      // Inicialmente recién creada: overdue = false
      const oInitial = await request(app).get(`/orders/${orderId}`).set(staffHeaders);
      expect(oInitial.body.overdue).toBe(false);

      // Simular que pasaron 20 minutos actualizando createdAt en DB
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: twentyMinsAgo },
      });

      // Ahora han pasado 20 mins > 15 mins (SLA) -> overdue = true
      const oOverdue = await request(app).get(`/orders/${orderId}`).set(staffHeaders);
      expect(oOverdue.body.overdue).toBe(true);

      // Staff asigna demora de 10 minutos (SLA total = 15 + 10 = 25 mins)
      const delayRes = await request(app)
        .patch(`/orders/${orderId}/delay`)
        .set(staffHeaders)
        .send({ delayMinutes: 10 });
      expect(delayRes.status).toBe(200);
      // 20 mins transcurridos < 25 mins SLA -> overdue = false
      expect(delayRes.body.overdue).toBe(false);

      // Si la orden pasa a DELIVERED, ya no es estado activo -> overdue = false siempre
      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'IN_KITCHEN' });
      await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'READY' });
      const deliveredRes = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(staffHeaders)
        .send({ status: 'DELIVERED' });
      expect(deliveredRes.body.overdue).toBe(false);

      // Verificar función unitaria pura computeOrderOverdue
      expect(
        computeOrderOverdue({
          status: 'PLACED',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          estimatedMinutes: 20,
          delayMinutes: 0,
        })
      ).toBe(true);

      expect(
        computeOrderOverdue({
          status: 'DELIVERED',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          estimatedMinutes: 20,
          delayMinutes: 0,
        })
      ).toBe(false);
    });
  });
});
