import request from 'supertest';
import nock from 'nock';
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
import { HttpSessionServiceAdapter } from '../../src/infrastructure/session/HttpSessionServiceAdapter';
import { TableSessionDTO } from '@packages/shared-types';

describe('V08 - R03b + R06 Session Guards and Table Derivation in Ordering (Contract Tests)', () => {
  let app: any;
  let sessionService: InMemorySessionServiceAdapter;
  const tenantId = 'tenant-guards-test';
  const tableId = 'mesa-vip-1';

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

    catalogValidation.products = [
      {
        productId: 'prod-taco',
        name: 'Tacos al Pastor',
        price: 15,
        isAvailable: true,
        modifierGroups: [
          {
            groupId: 'grp-salsa',
            name: 'Salsa',
            minSelections: 0,
            maxSelections: 1,
            isRequired: false,
            options: [{ optionId: 'opt-verde', name: 'Verde', priceDelta: 2 }],
          },
        ],
      },
      {
        productId: 'prod-bebida',
        name: 'Limonada Natural',
        price: 8,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

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
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    await disconnectTestInfra();
  });

  function setupSession(
    sessionId: string,
    status: 'active' | 'billRequested' | 'closed',
    sessTableId: string = tableId
  ): TableSessionDTO {
    const session: TableSessionDTO = {
      tenantId,
      sessionId,
      tableId: sessTableId,
      status,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    sessionService.setSession(session);
    return session;
  }

  describe('1. Sesión activa: operaciones de pedido permitidas', () => {
    it('permite agregar al carrito (201) y confirmar orden (201) persistiendo en Postgres real y vaciando Redis', async () => {
      const sessionId = 'session-active-ok';
      setupSession(sessionId, 'active', tableId);

      const headers = {
        'x-tenant-id': tenantId,
        'x-session-id': sessionId,
        'x-user-id': 'guest-1',
      };

      // 1. Agregar al carrito
      const addRes = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 2,
          modifiers: [{ groupId: 'grp-salsa', optionId: 'opt-verde' }],
          display: {
            productName: 'Tacos al Pastor',
            unitPrice: 15,
            modifierNames: [{ groupName: 'Salsa', optionName: 'Verde', priceDelta: 2 }],
          },
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.items).toHaveLength(1);
      expect(addRes.body.items[0].quantity).toBe(2);
      expect(addRes.body.total).toBe(34); // (15 + 2) * 2

      // 2. Confirmar orden
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(headers)
        .send({ tableId });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.status).toBe('PLACED');
      expect(confirmRes.body.tableId).toBe(tableId);
      expect(confirmRes.body.total).toBe(34);

      // Verificar persistencia en Postgres real
      const prisma = getTestPrisma();
      const savedOrders = await prisma.order.findMany({
        where: { tenantId, sessionId },
        include: { items: { include: { modifiers: true } } },
      });
      expect(savedOrders).toHaveLength(1);
      expect(savedOrders[0].tableId).toBe(tableId);
      expect(Number(savedOrders[0].total)).toBe(34);
      expect(savedOrders[0].items).toHaveLength(1);
      expect(savedOrders[0].items[0].modifiers).toHaveLength(1);

      // Verificar que el carrito en Redis quedó vacío tras confirmar
      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.status).toBe(200);
      expect(cartRes.body.items).toHaveLength(0);
      expect(cartRes.body.total).toBe(0);
    });
  });

  describe('2. Sesión en billRequested: pedidos bloqueados con 409 SESSION_NOT_ORDERABLE', () => {
    it('rechaza agregar al carrito con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-bill-req';
      setupSession(sessionId, 'billRequested', tableId);

      const headers = {
        'x-tenant-id': tenantId,
        'x-session-id': sessionId,
      };

      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');
      expect(res.body.error.message).toContain('La sesión no admite pedidos en su estado actual');
    });

    it('rechaza actualizar cantidad en carrito con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-bill-patch';
      // Primero activa para meter un ítem
      setupSession(sessionId, 'active', tableId);
      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const addRes = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });
      expect(addRes.status).toBe(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      // Pasa a billRequested
      setupSession(sessionId, 'billRequested', tableId);

      const patchRes = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set(headers)
        .send({ quantity: 3 });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('rechaza eliminar ítem del carrito (DELETE /cart/items/:id) en billRequested con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-bill-delete';
      setupSession(sessionId, 'active', tableId);
      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const addRes = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });
      expect(addRes.status).toBe(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      setupSession(sessionId, 'billRequested', tableId);

      const delRes = await request(app)
        .delete(`/cart/items/${cartItemId}`)
        .set(headers);

      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('rechaza confirmar orden con 409 SESSION_NOT_ORDERABLE y no persiste nada en Postgres', async () => {
      const sessionId = 'session-bill-confirm';
      setupSession(sessionId, 'active', tableId);
      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      // Pasa a billRequested antes de confirmar
      setupSession(sessionId, 'billRequested', tableId);

      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set(headers)
        .send({ tableId });

      expect(confirmRes.status).toBe(409);
      expect(confirmRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');

      // Verificar que NO se guardó ninguna orden en Postgres
      const prisma = getTestPrisma();
      const orders = await prisma.order.findMany({ where: { tenantId, sessionId } });
      expect(orders).toHaveLength(0);
    });
  });

  describe('3. Sesión closed: pedidos y llamadas bloqueados', () => {
    it('rechaza agregar al carrito con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-closed-cart';
      setupSession(sessionId, 'closed', tableId);

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const res = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('rechaza eliminar ítem del carrito (DELETE /cart/items/:id) en closed con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-closed-delete';
      setupSession(sessionId, 'active', tableId);
      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const addRes = await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });
      expect(addRes.status).toBe(201);
      const cartItemId = addRes.body.items[0].cartItemId;

      setupSession(sessionId, 'closed', tableId);

      const delRes = await request(app)
        .delete(`/cart/items/${cartItemId}`)
        .set(headers);

      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('rechaza confirmar orden con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-closed-confirm';
      setupSession(sessionId, 'closed', tableId);

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const res = await request(app)
        .post('/cart/confirm')
        .set(headers)
        .send({ tableId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('rechaza service-call cuando la sesión está closed con 409 SESSION_NOT_ORDERABLE', async () => {
      const sessionId = 'session-closed-call';
      setupSession(sessionId, 'closed', tableId);

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const res = await request(app)
        .post('/service-calls')
        .set(headers)
        .send({ tableId, note: 'Ayuda por favor' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');

      // Verificar que no se creó en Redis
      const redis = getTestRedis();
      const callsInRedis = await redis.keys(`*${sessionId}*`);
      expect(callsInRedis).toHaveLength(0);
    });

    it('permite service-call cuando la sesión está en billRequested (p.ej. pedir la cuenta o asistencia)', async () => {
      const sessionId = 'session-bill-call';
      setupSession(sessionId, 'billRequested', tableId);

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const res = await request(app)
        .post('/service-calls')
        .set(headers)
        .send({ note: '¿Pueden traer el datáfono?' });

      expect(res.status).toBe(201);
      expect(res.body.tableId).toBe(tableId);
      expect(res.body.status).toBe('pending');
    });
  });

  describe('4. Validación de mesa (tableId mismatch y derivación)', () => {
    it('rechaza confirmar orden con 409 TABLE_MISMATCH si el tableId del body difiere de la sesión', async () => {
      const sessionId = 'session-mismatch-test';
      setupSession(sessionId, 'active', 'mesa-autorizada');

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      // Cargar ítem al carrito
      await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      // Intentar confirmar mandando otra mesa en el body
      const res = await request(app)
        .post('/cart/confirm')
        .set(headers)
        .send({ tableId: 'mesa-falsa' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TABLE_MISMATCH');
      expect(res.body.error.message).toContain('La mesa indicada no coincide con la mesa de la sesión');

      // El carrito debe seguir intacto
      const cartRes = await request(app).get('/cart').set(headers);
      expect(cartRes.body.items).toHaveLength(1);
    });

    it('deriva estrictamente el tableId de la sesión si no se envía tableId en body', async () => {
      const sessionId = 'session-derive-test';
      setupSession(sessionId, 'active', 'mesa-terraza-5');

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      await request(app)
        .post('/cart/items')
        .set(headers)
        .send({
          productId: 'prod-bebida',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Limonada', unitPrice: 8, modifierNames: [] },
        });

      // Confirmar sin enviar body.tableId
      const res = await request(app)
        .post('/cart/confirm')
        .set(headers)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.tableId).toBe('mesa-terraza-5');

      // Verificar en Postgres
      const prisma = getTestPrisma();
      const order = await prisma.order.findUnique({ where: { id: res.body.id } });
      expect(order?.tableId).toBe('mesa-terraza-5');
    });

    it('rechaza service-call con 409 TABLE_MISMATCH si el tableId no coincide', async () => {
      const sessionId = 'session-call-mismatch';
      setupSession(sessionId, 'active', 'mesa-real');

      const headers = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };

      const res = await request(app)
        .post('/service-calls')
        .set(headers)
        .send({ tableId: 'mesa-equivocada', note: 'Mozo' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TABLE_MISMATCH');
    });

    it('rechaza checkout con 409 TABLE_MISMATCH si el tableId provisto difiere de la sesión', async () => {
      const sessionId = 'session-checkout-mismatch';
      setupSession(sessionId, 'active', 'mesa-autorizada');

      const guestHeaders = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };
      const staffHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-cajero',
        'x-user-role': 'staff',
      };

      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-autorizada' });

      const checkoutRes = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          tableId: 'mesa-ajena',
          method: 'CASH',
        });

      expect(checkoutRes.status).toBe(409);
      expect(checkoutRes.body.error.code).toBe('TABLE_MISMATCH');
    });
  });

  describe('5. Simulación pedido + cobro simultáneos (Barrera de Liquidación)', () => {
    it('tras el cobro y cierre de sesión, cualquier pedido pendiente o posterior es rechazado con 409 y ningún pedido post-cobro es aceptado', async () => {
      const sessionId = 'session-simultaneous-race';
      setupSession(sessionId, 'active', tableId);

      const guestHeaders = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };
      const staffHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-cajero',
        'x-user-role': 'staff',
      };

      // 1. Guest pide primer plato y lo confirma
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-taco',
          quantity: 2,
          modifiers: [],
          display: { productName: 'Tacos al Pastor', unitPrice: 15, modifierNames: [] },
        });

      const order1Res = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId });
      expect(order1Res.status).toBe(201);
      const order1Id = order1Res.body.id;

      // 2. Guest añade un segundo plato al carrito (pero aún no lo confirma)
      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-bebida',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Limonada', unitPrice: 8, modifierNames: [] },
        });

      // 3. Staff realiza el checkout (cobro de la sesión)
      const checkoutRes = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          tableId,
          method: 'CASH',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.payment).toBeDefined();
      expect(checkoutRes.body.bill.total).toBe(30); // Solo incluye orden 1
      expect(checkoutRes.body.payment.amount).toBe(30);

      // Verificar que la sesión quedó cerrada en el sessionService
      const closedSession = await sessionService.getSession(tenantId, sessionId);
      expect(closedSession?.status).toBe('closed');

      // 4. Guest intenta confirmar el segundo pedido que tenía en el carrito tras el cobro -> DEBE SER RECHAZADO (409)
      const postCheckoutConfirmRes = await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId });

      expect(postCheckoutConfirmRes.status).toBe(409);
      expect(postCheckoutConfirmRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');

      // 5. Guest intenta agregar un nuevo ítem post-cobro -> DEBE SER RECHAZADO (409)
      const postCheckoutAddRes = await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-bebida',
          quantity: 2,
          modifiers: [],
          display: { productName: 'Limonada', unitPrice: 8, modifierNames: [] },
        });

      expect(postCheckoutAddRes.status).toBe(409);
      expect(postCheckoutAddRes.body.error.code).toBe('SESSION_NOT_ORDERABLE');

      // 6. Invariante fundamental en PostgreSQL: solo existe la Orden 1; NINGUNA orden post-cobro fue persistida
      const prisma = getTestPrisma();
      const allOrders = await prisma.order.findMany({
        where: { tenantId, sessionId },
      });

      expect(allOrders).toHaveLength(1);
      expect(allOrders[0].id).toBe(order1Id);
      expect(Number(allOrders[0].total)).toBe(30);

      const allPayments = await prisma.payment.findMany({
        where: { tenantId, sessionId },
      });
      expect(allPayments).toHaveLength(1);
      expect(Number(allPayments[0].amount)).toBe(30);
    });
  });

  describe('7. ConfirmCheckout Session Guards y Reintentos Idempotentes', () => {
    it('permite cobro (POST /checkout/confirm) en estado billRequested con 201 OK', async () => {
      const sessionId = 'session-checkout-bill-req';
      setupSession(sessionId, 'active', tableId);

      const guestHeaders = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };
      const staffHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-cajero',
        'x-user-role': 'staff',
      };

      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-taco',
          quantity: 2,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId });

      setupSession(sessionId, 'billRequested', tableId);

      const checkoutRes = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          tableId,
          method: 'CASH',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.payment).toBeDefined();
      expect(checkoutRes.body.payment.amount).toBe(30);
      expect(checkoutRes.body.bill.total).toBe(30);
      expect(checkoutRes.body.payment.tableId).toBe(tableId);
      expect(checkoutRes.body.bill.tableId).toBe(tableId);
    });

    it('permite reintento de cobro en sesión closed con pago previo (idempotente 200) y rechaza cobro en closed sin pago previo (409 SESSION_NOT_ORDERABLE)', async () => {
      const sessionId = 'session-checkout-closed-retry';
      setupSession(sessionId, 'active', tableId);

      const guestHeaders = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };
      const staffHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-cajero',
        'x-user-role': 'staff',
      };

      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId });

      // 1. Cobro inicial exitoso (201)
      const firstCheckout = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          tableId,
          method: 'CASH',
        });
      expect(firstCheckout.status).toBe(201);

      // Ahora la sesión está closed
      const sess = await sessionService.getSession(tenantId, sessionId);
      expect(sess?.status).toBe('closed');

      // 2. Reintento de cobro en sesión closed con pago previo -> 200 idempotente
      const retryCheckout = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          tableId,
          method: 'CASH',
        });
      expect(retryCheckout.status).toBe(200);
      expect(retryCheckout.body.payment.id).toBe(firstCheckout.body.payment.id);

      // 3. Intento de cobro en sesión closed SIN pago previo -> debe dar 409 SESSION_NOT_ORDERABLE
      const sessionWithoutPayment = 'session-closed-no-payment';
      setupSession(sessionWithoutPayment, 'closed', tableId);

      const prisma = getTestPrisma();
      await prisma.order.create({
        data: {
          id: 'ord-orphan-test',
          tenantId,
          sessionId: sessionWithoutPayment,
          tableId,
          status: 'PLACED',
          total: 15,
        },
      });

      const rejectClosed = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId: sessionWithoutPayment,
          tableId,
          method: 'CASH',
        });

      expect(rejectClosed.status).toBe(409);
      expect(rejectClosed.body.error.code).toBe('SESSION_NOT_ORDERABLE');
    });

    it('deriva effectiveTableId de la sesión si no se envía tableId en body de checkout', async () => {
      const sessionId = 'session-checkout-derive-table';
      setupSession(sessionId, 'active', 'mesa-terraza-8');

      const guestHeaders = { 'x-tenant-id': tenantId, 'x-session-id': sessionId };
      const staffHeaders = {
        'x-tenant-id': tenantId,
        'x-user-id': 'staff-cajero',
        'x-user-role': 'staff',
      };

      await request(app)
        .post('/cart/items')
        .set(guestHeaders)
        .send({
          productId: 'prod-taco',
          quantity: 1,
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 15, modifierNames: [] },
        });

      await request(app)
        .post('/cart/confirm')
        .set(guestHeaders)
        .send({ tableId: 'mesa-terraza-8' });

      const checkoutRes = await request(app)
        .post('/checkout/confirm')
        .set(staffHeaders)
        .send({
          sessionId,
          method: 'CASH',
        });

      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.payment.tableId).toBe('mesa-terraza-8');
      expect(checkoutRes.body.bill.tableId).toBe('mesa-terraza-8');
    });
  });

  describe('6. HttpSessionServiceAdapter: contrato HTTP hacia session service', () => {
    const httpAdapter = new HttpSessionServiceAdapter('http://mock-session:4003');
    const origSecret = process.env.INTERNAL_SHARED_SECRET;

    beforeAll(() => {
      process.env.INTERNAL_SHARED_SECRET = 'test-internal-secret';
    });

    afterAll(() => {
      if (origSecret) process.env.INTERNAL_SHARED_SECRET = origSecret;
      else delete process.env.INTERNAL_SHARED_SECRET;
    });

    it('retorna TableSessionDTO cuando session service responde HTTP 200', async () => {
      const mockSession: TableSessionDTO = {
        sessionId: 'sess-http-200',
        tenantId: 't-http',
        tableId: 'tb-1',
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      nock('http://mock-session:4003')
        .get('/sessions/sess-http-200')
        .matchHeader('x-tenant-id', 't-http')
        .matchHeader('x-internal-token', (val) => Boolean(val))
        .reply(200, mockSession);

      const result = await httpAdapter.getSession('t-http', 'sess-http-200');
      expect(result).toEqual(mockSession);
    });

    it('retorna null cuando session service responde HTTP 404', async () => {
      nock('http://mock-session:4003')
        .get('/sessions/sess-not-found')
        .matchHeader('x-tenant-id', 't-http')
        .reply(404, { error: { code: 'SESSION_NOT_FOUND', message: 'Not found' } });

      const result = await httpAdapter.getSession('t-http', 'sess-not-found');
      expect(result).toBeNull();
    });

    it('lanza error cuando session service responde 500', async () => {
      nock('http://mock-session:4003')
        .get('/sessions/sess-err')
        .reply(500, 'Internal Server Error');

      await expect(httpAdapter.getSession('t-http', 'sess-err')).rejects.toThrow(
        /Session service responded with status 500/
      );
    });
  });
});
