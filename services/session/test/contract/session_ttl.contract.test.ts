import {
  ensureContractEnv,
  getTestRedis,
  flushSessionRedis,
  disconnectTestRedis,
} from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import { RedisZoneRepository } from '../../src/infrastructure/redis/RedisZoneRepository';
import { RedisKeys } from '../../src/infrastructure/redis/keys';
import { createSessionApp } from '../../src/app';
import request from 'supertest';

describe('U11 [R2]: Sesión con TTL de 1 hora (3600s) y renovación por actividad', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let zoneRepo: RedisZoneRepository;
  let app: any;

  const tenantId = 'tenant-ttl-test';
  const tableId = 'table-ttl-1';
  const qrKey = 'valid-ttl-qr-key';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    zoneRepo = new RedisZoneRepository(redis);

    app = createSessionApp({
      tableRepo,
      sessionRepo,
      zoneRepo,
    });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();

    await zoneRepo.save(tenantId, { id: 'z-ttl', tenantId, name: 'Zona TTL', sortOrder: 1 });
    await tableRepo.save(tenantId, {
      tableId,
      tenantId,
      label: 'Mesa TTL 1',
      capacity: 4,
      zoneId: 'z-ttl',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      qrKey,
    });
  });

  test('1. Apertura de sesión fija TTL de ~3600s en la clave session:{id} y en el puntero de mesa', async () => {
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff')
      .send({ tableId });

    expect(openRes.status).toBe(200);
    const sessionId = openRes.body.session.sessionId;

    const sessionKey = RedisKeys.session(sessionId);
    const ttl = await redis.ttl(sessionKey);

    expect(ttl).toBeGreaterThanOrEqual(3500);
    expect(ttl).toBeLessThanOrEqual(3600);

    const pointerKey = RedisKeys.tableSessionPointer(tenantId, tableId);
    const pointerTtl = await redis.ttl(pointerKey);
    expect(pointerTtl).toBeGreaterThanOrEqual(3500);
    expect(pointerTtl).toBeLessThanOrEqual(3600);
  });

  test('2. Actividad relevante (solicitar cuenta) renueva el TTL a ~3600s', async () => {
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff')
      .send({ tableId });

    const sessionId = openRes.body.session.sessionId;
    const sessionKey = RedisKeys.session(sessionId);

    // Simulamos que el TTL bajó a 1800s (media hora)
    await redis.expire(sessionKey, 1800);
    const reducedTtl = await redis.ttl(sessionKey);
    expect(reducedTtl).toBeLessThanOrEqual(1800);

    // Solicitamos la cuenta
    const billRes = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(billRes.status).toBe(200);

    // El TTL debe haberse renovado a ~3600s
    const renewedTtl = await redis.ttl(sessionKey);
    expect(renewedTtl).toBeGreaterThanOrEqual(3500);
    expect(renewedTtl).toBeLessThanOrEqual(3600);
  });
});
