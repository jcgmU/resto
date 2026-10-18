import request from 'supertest';
import {
  ensureContractEnv,
  getTestRedis,
  flushSessionRedis,
  disconnectTestRedis,
} from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import { RedisZoneRepository } from '../../src/infrastructure/redis/RedisZoneRepository';
import { RedisReservationRepository } from '../../src/infrastructure/redis/RedisReservationRepository';
import { HttpIdentitySettingsAdapter } from '../../src/infrastructure/identity/HttpIdentitySettingsAdapter';
import { InMemoryIdentitySettingsAdapter } from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

describe('V21 Waiter Mode Contract Test (Session Service con Redis Real db2)', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let zoneRepo: RedisZoneRepository;
  let reservationRepo: RedisReservationRepository;
  let inMemorySettings: InMemoryIdentitySettingsAdapter;
  let app: any;

  const tenantId = 'tenant-waiter-mode-test';
  const tableId = 'tb-waiter-1';
  const qrKey = 'qr-key-waiter-123';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    zoneRepo = new RedisZoneRepository(redis);
    reservationRepo = new RedisReservationRepository(redis);
    inMemorySettings = new InMemoryIdentitySettingsAdapter();

    app = createSessionApp({
      redis,
      tableRepo,
      sessionRepo,
      zoneRepo,
      reservationRepo,
      identitySettings: inMemorySettings,
    });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();
    // Crear mesa activa para pruebas
    await tableRepo.save(tenantId, {
      tableId,
      tenantId,
      label: 'Mesa 1',
      status: 'AVAILABLE',
      capacity: 4,
      qrKey,
      createdAt: new Date().toISOString(),
    });
  });

  describe('1. Apertura por código QR (POST /sessions/open)', () => {
    it('con waiter_only: POST /sessions/open responde 403 QR_DISABLED', async () => {
      inMemorySettings.setOperatingMode(tenantId, 'waiter_only');

      const res = await request(app)
        .post('/sessions/open')
        .send({
          tenantId,
          tableId,
          qrKey,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('QR_DISABLED');
      expect(res.body.error.message).toContain('El pedido por código QR está desactivado en este restaurante');
    });

    it('con hybrid: POST /sessions/open funciona normal (200 OK con sesión y guestToken)', async () => {
      inMemorySettings.setOperatingMode(tenantId, 'hybrid');

      const res = await request(app)
        .post('/sessions/open')
        .send({
          tenantId,
          tableId,
          qrKey,
        });

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.tableId).toBe(tableId);
      expect(res.body.session.status).toBe('active');
      expect(res.body.guestToken).toBeDefined();
      expect(typeof res.body.guestToken).toBe('string');
    });
  });

  describe('2. Apertura por personal / mesero (POST /sessions/staff-open)', () => {
    it('con waiter_only: staff (WAITER) abre la sesión atómicamente respondiendo 200 con { session }', async () => {
      inMemorySettings.setOperatingMode(tenantId, 'waiter_only');

      const res = await request(app)
        .post('/sessions/staff-open')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'WAITER')
        .send({
          tableId,
        });

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.sessionId).toBeDefined();
      expect(res.body.session.tableId).toBe(tableId);
      expect(res.body.session.status).toBe('active');

      const createdSessionId = res.body.session.sessionId;

      // Segunda llamada para la misma mesa recupera la sesión activa de forma atómica
      const secondRes = await request(app)
        .post('/sessions/staff-open')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'WAITER')
        .send({
          tableId,
        });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.session.sessionId).toBe(createdSessionId);
    });

    it('con hybrid: staff (ADMIN, MANAGER, STAFF) también puede abrir sesión con staff-open', async () => {
      inMemorySettings.setOperatingMode(tenantId, 'hybrid');

      const roles = ['ADMIN', 'MANAGER', 'STAFF'];
      for (const role of roles) {
        await flushSessionRedis();
        await tableRepo.save(tenantId, {
          tableId,
          tenantId,
          label: 'Mesa 1',
          status: 'AVAILABLE',
          capacity: 4,
          qrKey,
          createdAt: new Date().toISOString(),
        });

        const res = await request(app)
          .post('/sessions/staff-open')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .send({
            tableId,
          });

        expect(res.status).toBe(200);
        expect(res.body.session.status).toBe('active');
      }
    });

    it('rechaza con 403 FORBIDDEN si el requester no tiene rol staff autorizado', async () => {
      const res = await request(app)
        .post('/sessions/staff-open')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'guest')
        .send({
          tableId,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('permite abrir sesión con rol staff en modo waiter_only en /sessions/staff-open', async () => {
      inMemorySettings.setOperatingMode(tenantId, 'waiter_only');

      const res = await request(app)
        .post('/sessions/staff-open')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'WAITER')
        .send({
          tableId,
        });

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
    });
  });

  describe('3. Caché en memoria en HttpIdentitySettingsAdapter', () => {
    it('almacena en caché el operatingMode respetando el TTL para no saturar HTTP', async () => {
      const adapter = new HttpIdentitySettingsAdapter('http://localhost:4001', 30000);
      adapter.setCachedMode('tenant-cached', 'waiter_only');

      const mode = await adapter.getOperatingMode('tenant-cached');
      expect(mode).toBe('waiter_only');

      adapter.clearCache();
      // Sin servidor levantado en puerto inexistente devuelve fallback hybrid
      const fallbackMode = await adapter.getOperatingMode('tenant-nonexistent');
      expect(fallbackMode).toBe('hybrid');
    });
  });
});
