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
    it('permite a staff actualizar delayMinutes con entero >= 0', async () => {
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
