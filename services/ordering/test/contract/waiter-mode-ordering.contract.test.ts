import request from 'supertest';
import jwt from 'jsonwebtoken';
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
  InMemoryIdentitySettingsAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { config } from '../../src/config';
import { TableSessionDTO } from '@packages/shared-types';

describe('V21 Waiter Mode & Staff Ordering Contract Test (Postgres + Redis Reales)', () => {
  let app: any;
  let sessionService: InMemorySessionServiceAdapter;
  let identitySettings: InMemoryIdentitySettingsAdapter;
  let orderRepo: PrismaOrderRepository;
  let cartRepo: RedisCartRepository;

  const tenantId = 'tenant-waiter-ord-test';
  const tableId = 'mesa-salon-4';
  const sessionId = 'session-table-4-active';

  beforeAll(async () => {
    await ensureContractEnv();
    const redis = getTestRedis();
    const prisma = getTestPrisma();

    cartRepo = new RedisCartRepository(redis);
    orderRepo = new PrismaOrderRepository(prisma);
    const paymentRepo = new PrismaPaymentRepository(prisma);
    const serviceCallRepo = new RedisServiceCallRepository(redis);
    const eventPublisher = new RedisEventPublisher(redis);
    const catalogValidation = new InMemoryCatalogValidationAdapter();

    catalogValidation.products = [
      {
        productId: 'prod-bandeja-paisa',
        name: 'Bandeja Paisa Tradicional',
        price: 32000,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    sessionService = new InMemorySessionServiceAdapter({ autoCreateActive: false });
    identitySettings = new InMemoryIdentitySettingsAdapter();

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
    await flushOrderingRedis();
    await truncateOrderingDb();
    sessionService.sessions.clear();

    // Configurar sesión activa para mesa 4
    const session: TableSessionDTO = {
      tenantId,
      sessionId,
      tableId,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    sessionService.setSession(session);
  });

  afterAll(async () => {
    await disconnectTestInfra();
  });

  describe('1. Modo waiter_only: restricción a clientes guest', () => {
    it('con waiter_only: guest no puede agregar productos al carrito (409 SESSION_NOT_ORDERABLE)', async () => {
      identitySettings.setOperatingMode(tenantId, 'waiter_only');

      const guestToken = jwt.sign(
        { tenantId, sessionId, role: 'guest' },
        config.jwtSecret
      );

      const res = await request(app)
        .post('/cart/items')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 1,
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');
      expect(res.body.error.message).toContain('El autoservicio por QR está inactivo en modo solo meseros');
    });

    it('con waiter_only: guest no puede confirmar pedido (409 SESSION_NOT_ORDERABLE)', async () => {
      identitySettings.setOperatingMode(tenantId, 'waiter_only');

      // Sembrar ítem en carrito directamente
      await cartRepo.upsertItem(
        tenantId,
        sessionId,
        {
          cartItemId: 'ci-existente',
          productId: 'prod-bandeja-paisa',
          productName: 'Bandeja Paisa Tradicional',
          unitPrice: 32000,
          modifiers: [],
          quantity: 1,
          lineTotal: 32000,
          addedAt: new Date().toISOString(),
        },
        3600
      );

      const guestToken = jwt.sign(
        { tenantId, sessionId, role: 'guest' },
        config.jwtSecret
      );

      const res = await request(app)
        .post('/cart/confirm')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          notes: 'Sin aguacate',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('SESSION_NOT_ORDERABLE');
      expect(res.body.error.message).toContain('El autoservicio por QR está inactivo en modo solo meseros');
    });
  });

  describe('2. Modo waiter_only: staff toma pedidos para la mesa', () => {
    it('con waiter_only: staff (WAITER) con x-session-id explícito puede agregar ítems y confirmar pedido', async () => {
      identitySettings.setOperatingMode(tenantId, 'waiter_only');

      const staffToken = jwt.sign(
        { tenantId, role: 'WAITER', userId: 'waiter-user-1' },
        config.jwtSecret
      );

      // 1. Staff agrega ítem a la comanda de la mesa usando x-session-id
      const addRes = await request(app)
        .post('/cart/items')
        .set('authorization', `Bearer ${staffToken}`)
        .set('x-session-id', sessionId)
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 2,
          notes: 'Una bien cocida',
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.items).toHaveLength(1);
      expect(addRes.body.items[0].quantity).toBe(2);

      // 2. Staff confirma el pedido para la cocina
      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set('authorization', `Bearer ${staffToken}`)
        .set('x-session-id', sessionId)
        .send({
          notes: 'Mesa 4 comanda de mesero',
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.id).toBeDefined();
      expect(confirmRes.body.tableId).toBe(tableId);
      expect(confirmRes.body.status).toBe('PLACED');
      expect(confirmRes.body.total).toBe(64000);

      // 3. Verificar persistencia en Postgres real
      const persistedOrder = await orderRepo.findById(tenantId, confirmRes.body.id);
      expect(persistedOrder).not.toBeNull();
      expect(persistedOrder!.sessionId).toBe(sessionId);
      expect(persistedOrder!.tableId).toBe(tableId);
    });

    it('también funciona con roles STAFF, MANAGER o ADMIN con x-session-id por cabeceras directas', async () => {
      identitySettings.setOperatingMode(tenantId, 'waiter_only');

      const addRes = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'MANAGER')
        .set('x-session-id', sessionId)
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 1,
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(addRes.status).toBe(201);

      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'MANAGER')
        .set('x-session-id', sessionId)
        .send({});

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.tableId).toBe(tableId);
    });
  });

  describe('3. Prevención de spoofing de sesión para guests', () => {
    it('Guest spoofing con x-session-id ajeno recibe 403 FORBIDDEN en /cart/items', async () => {
      identitySettings.setOperatingMode(tenantId, 'hybrid');

      const guestToken = jwt.sign(
        { tenantId, sessionId: 'session-guest-legitimate', role: 'guest' },
        config.jwtSecret
      );

      // Intento de inyectar comanda a una sesión ajena
      const res = await request(app)
        .post('/cart/items')
        .set('authorization', `Bearer ${guestToken}`)
        .set('x-session-id', 'session-victim-table-9')
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 1,
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Guest spoofing con x-session-id ajeno recibe 403 FORBIDDEN en /cart/confirm', async () => {
      identitySettings.setOperatingMode(tenantId, 'hybrid');

      const guestToken = jwt.sign(
        { tenantId, sessionId: 'session-guest-legitimate', role: 'guest' },
        config.jwtSecret
      );

      const res = await request(app)
        .post('/cart/confirm')
        .set('authorization', `Bearer ${guestToken}`)
        .set('x-session-id', 'session-victim-table-9')
        .send({
          notes: 'Intento de confirmación no autorizada',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Guest spoofing con x-token-session-id header dispar recibe 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'guest')
        .set('x-token-session-id', 'session-token-1')
        .set('x-session-id', 'session-spoofed-2')
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 1,
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Modo hybrid: autoservicio guest funciona normal', () => {
    it('con hybrid: guest puede agregar ítems y confirmar pedido', async () => {
      identitySettings.setOperatingMode(tenantId, 'hybrid');

      const guestToken = jwt.sign(
        { tenantId, sessionId, role: 'guest' },
        config.jwtSecret
      );

      const addRes = await request(app)
        .post('/cart/items')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          productId: 'prod-bandeja-paisa',
          quantity: 1,
          display: {
            productName: 'Bandeja Paisa Tradicional',
            unitPrice: 32000,
            modifierNames: [],
          },
        });

      expect(addRes.status).toBe(201);

      const confirmRes = await request(app)
        .post('/cart/confirm')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          notes: 'Cliente hybrid',
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.status).toBe('PLACED');
      expect(confirmRes.body.tableId).toBe(tableId);
    });

    test('ServiceCall con type en Redis real persiste y se recupera correctamente (WAITER_CALL y default GENERIC)', async () => {
      const redis = getTestRedis();
      const serviceCallRepo = new RedisServiceCallRepository(redis);

      const callWaiter = await serviceCallRepo.save(
        tenantId,
        {
          callId: 'call-contract-waiter-1',
          tenantId,
          sessionId,
          tableId,
          type: 'WAITER_CALL',
          note: 'Solicitud de mesero en mesa',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        3600
      );
      expect(callWaiter.type).toBe('WAITER_CALL');

      const foundWaiter = await serviceCallRepo.findById(tenantId, 'call-contract-waiter-1');
      expect(foundWaiter).not.toBeNull();
      expect(foundWaiter?.type).toBe('WAITER_CALL');
      expect(foundWaiter?.note).toBe('Solicitud de mesero en mesa');

      const callGeneric = await serviceCallRepo.save(
        tenantId,
        {
          callId: 'call-contract-generic-1',
          tenantId,
          sessionId,
          tableId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        3600
      );
      expect(callGeneric.type).toBe('GENERIC');

      const foundGeneric = await serviceCallRepo.findById(tenantId, 'call-contract-generic-1');
      expect(foundGeneric).not.toBeNull();
      expect(foundGeneric?.type).toBe('GENERIC');
    });

    test('POST /service-calls con BILL_REQUEST crea llamada visible en GET /service-calls?status=pending y type inválido retorna 400', async () => {
      const guestToken = jwt.sign(
        { tenantId, sessionId, role: 'guest' },
        config.jwtSecret
      );
      const staffToken = jwt.sign(
        { tenantId, userId: 'staff-1', role: 'staff' },
        config.jwtSecret
      );

      // 1. Type inválido debe fallar con 400 VALIDATION_ERROR
      const invalidTypeRes = await request(app)
        .post('/service-calls')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          tableId,
          type: 'INVENTED_TYPE',
          note: 'Tipo no soportado',
        });

      expect(invalidTypeRes.status).toBe(400);
      expect(invalidTypeRes.body.error.code).toBe('VALIDATION_ERROR');

      // 2. Type BILL_REQUEST válido crea service-call 201
      const validRes = await request(app)
        .post('/service-calls')
        .set('authorization', `Bearer ${guestToken}`)
        .send({
          tableId,
          type: 'BILL_REQUEST',
          note: 'Por favor traer la cuenta',
        });

      expect(validRes.status).toBe(201);
      expect(validRes.body.type).toBe('BILL_REQUEST');
      expect(validRes.body.status).toBe('pending');
      expect(validRes.body.tableId).toBe(tableId);

      // 3. Visible en GET /service-calls?status=pending para staff
      const listRes = await request(app)
        .get('/service-calls?status=pending')
        .set('authorization', `Bearer ${staffToken}`);

      expect(listRes.status).toBe(200);
      const createdCall = listRes.body.find((c: any) => c.callId === validRes.body.callId);
      expect(createdCall).toBeDefined();
      expect(createdCall.type).toBe('BILL_REQUEST');
      expect(createdCall.status).toBe('pending');
    });
  });
});
