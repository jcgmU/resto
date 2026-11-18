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
import { RedisKeys } from '../../src/infrastructure/redis/keys';
import { createSessionApp } from '../../src/app';
import request from 'supertest';

describe('U13 [R12]: Cambio atómico de mesa (move table session)', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let zoneRepo: RedisZoneRepository;
  let reservationRepo: RedisReservationRepository;
  let app: any;
  let publishedEvents: any[] = [];

  const tenantId = 'tenant-move-test';
  const sourceTableId = 'table-move-source';
  const targetTableId = 'table-move-target';
  const occupiedTableId = 'table-move-occupied';
  const disabledTableId = 'table-move-disabled';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    zoneRepo = new RedisZoneRepository(redis);
    reservationRepo = new RedisReservationRepository(redis);

    const fakeEventPublisher = {
      publishSessionEvent: async (tId: string, event: any) => {
        publishedEvents.push({ tenantId: tId, ...event });
      },
    };

    app = createSessionApp({
      tableRepo,
      sessionRepo,
      zoneRepo,
      reservationRepo,
      eventPublisher: fakeEventPublisher as any,
    });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();
    publishedEvents = [];

    await zoneRepo.save(tenantId, { id: 'z-move', tenantId, name: 'Zona Move', sortOrder: 1 });

    await tableRepo.save(tenantId, {
      tableId: sourceTableId,
      tenantId,
      label: 'Mesa 1 (Origen)',
      capacity: 4,
      zoneId: 'z-move',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      qrKey: 'qr-source',
    });

    await tableRepo.save(tenantId, {
      tableId: targetTableId,
      tenantId,
      label: 'Mesa 2 (Destino Libre)',
      capacity: 4,
      zoneId: 'z-move',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      qrKey: 'qr-target',
    });

    await tableRepo.save(tenantId, {
      tableId: occupiedTableId,
      tenantId,
      label: 'Mesa 3 (Ocupada)',
      capacity: 4,
      zoneId: 'z-move',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      qrKey: 'qr-occupied',
    });

    await tableRepo.save(tenantId, {
      tableId: disabledTableId,
      tenantId,
      label: 'Mesa 4 (Deshabilitada)',
      capacity: 4,
      zoneId: 'z-move',
      status: 'DISABLED',
      createdAt: new Date().toISOString(),
      qrKey: 'qr-disabled',
    });
  });

  test('1. Mover sesión activa a mesa libre actualiza punteros Redis atómicamente y emite eventos', async () => {
    // Abrir sesión en mesa origen
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: sourceTableId });

    expect(openRes.status).toBe(200);
    const sessionId = openRes.body.session.sessionId;

    // Verificar puntero inicial
    const initialSourcePointer = await redis.get(RedisKeys.tableSessionPointer(tenantId, sourceTableId));
    expect(initialSourcePointer).toBe(sessionId);

    // Mover a targetTableId
    const moveRes = await request(app)
      .post(`/sessions/${sessionId}/move`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ targetTableId });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.tableId).toBe(targetTableId);
    expect(moveRes.body.sessionId).toBe(sessionId);
    expect(moveRes.body.status).toBe('active');

    // Verificar punteros en Redis: el viejo borrado, el nuevo apunta a sessionId
    const sourcePointerAfter = await redis.get(RedisKeys.tableSessionPointer(tenantId, sourceTableId));
    expect(sourcePointerAfter).toBeNull();

    const targetPointerAfter = await redis.get(RedisKeys.tableSessionPointer(tenantId, targetTableId));
    expect(targetPointerAfter).toBe(sessionId);

    // Verificar TTL en el nuevo puntero
    const targetTtl = await redis.ttl(RedisKeys.tableSessionPointer(tenantId, targetTableId));
    expect(targetTtl).toBeGreaterThan(0);

    // Verificar eventos publicados: origen AVAILABLE, destino OCCUPIED con action session_moved
    const moveEvents = publishedEvents.filter((e) => e.action === 'session_moved');
    expect(moveEvents.length).toBe(2);

    const sourceEvent = moveEvents.find((e) => e.tableId === sourceTableId);
    expect(sourceEvent).toBeDefined();
    expect(sourceEvent.status).toBe('AVAILABLE');
    expect(sourceEvent.sourceTableId).toBe(sourceTableId);
    expect(sourceEvent.targetTableId).toBe(targetTableId);

    const targetEvent = moveEvents.find((e) => e.tableId === targetTableId);
    expect(targetEvent).toBeDefined();
    expect(targetEvent.status).toBe('OCCUPIED');
    expect(targetEvent.sourceTableId).toBe(sourceTableId);
    expect(targetEvent.targetTableId).toBe(targetTableId);
  });

  test('2. Intento de mover a mesa ocupada responde 409 TABLE_HAS_ACTIVE_SESSION', async () => {
    // Abrir sesión en origen
    const open1 = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: sourceTableId });
    const session1Id = open1.body.session.sessionId;

    // Abrir sesión en occupiedTableId
    await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: occupiedTableId });

    // Intentar mover session1 a occupiedTableId
    const moveRes = await request(app)
      .post(`/sessions/${session1Id}/move`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ targetTableId: occupiedTableId });

    expect(moveRes.status).toBe(409);
    expect(moveRes.body.error?.code).toBe('TABLE_HAS_ACTIVE_SESSION');

    // Origen intacto
    const sourcePointer = await redis.get(RedisKeys.tableSessionPointer(tenantId, sourceTableId));
    expect(sourcePointer).toBe(session1Id);
  });

  test('3. Intento de mover a mesa inexistente responde 404 TABLE_NOT_FOUND', async () => {
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: sourceTableId });
    const sessionId = openRes.body.session.sessionId;

    const moveRes = await request(app)
      .post(`/sessions/${sessionId}/move`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ targetTableId: 'mesa-inexistente-xyz' });

    expect(moveRes.status).toBe(404);
    expect(moveRes.body.error?.code).toBe('TABLE_NOT_FOUND');
  });

  test('4. Intento de mover a mesa deshabilitada responde 400 TABLE_INACTIVE', async () => {
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: sourceTableId });
    const sessionId = openRes.body.session.sessionId;

    const moveRes = await request(app)
      .post(`/sessions/${sessionId}/move`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ targetTableId: disabledTableId });

    expect(moveRes.status).toBe(400);
    expect(moveRes.body.error?.code).toBe('TABLE_INACTIVE');
  });

  test('5. Intento de mover por rol no autorizado responde 403 FORBIDDEN', async () => {
    const openRes = await request(app)
      .post('/sessions/staff-open')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ tableId: sourceTableId });
    const sessionId = openRes.body.session.sessionId;

    const moveRes = await request(app)
      .post(`/sessions/${sessionId}/move`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'guest')
      .send({ targetTableId });

    expect(moveRes.status).toBe(403);
  });
});
