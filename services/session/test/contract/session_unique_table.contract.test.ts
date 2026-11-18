import request from 'supertest';
import { ensureContractEnv, getTestRedis, flushSessionRedis, disconnectTestRedis } from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import { createSessionApp } from '../../src/app';

describe('Una mesa no puede tener dos sesiones activas (listado de activas)', () => {
  const tenantId = 'tenant-unique-table';
  const staff = { 'x-tenant-id': tenantId, 'x-user-role': 'admin' };
  const tables = ['table-u1', 'table-u2'];
  let redis: any;
  let app: any;
  let server: any;

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    const tableRepo = new RedisTableRepository(redis);
    app = createSessionApp({ tableRepo, sessionRepo: new RedisTableSessionRepository(redis) });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();
    const tableRepo = new RedisTableRepository(redis);
    for (const tableId of tables) {
      await tableRepo.save(tenantId, { tableId, tenantId, label: tableId, status: 'active', qrKey: `qr-${tableId}`, createdAt: new Date().toISOString() });
    }
    server = app.listen(0);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('aperturas mezcladas y concurrentes (QR de invitado y staff-open) dejan una sola sesión por mesa en GET /sessions', async () => {
    const guestOpens = tables.flatMap((tableId) =>
      Array.from({ length: 5 }, () => request(server).post('/sessions/open').send({ tenantId, tableId, qrKey: `qr-${tableId}` })),
    );
    const staffOpens = tables.flatMap((tableId) =>
      Array.from({ length: 5 }, () => request(server).post('/sessions/staff-open').set(staff).send({ tableId })),
    );
    const responses = await Promise.all([...guestOpens, ...staffOpens]);
    responses.forEach((res) => expect(res.status).toBe(200));

    const listed = await request(server).get('/sessions').set(staff);
    expect(listed.status).toBe(200);
    const active = listed.body.filter((s: { status: string }) => s.status !== 'closed');
    expect(active).toHaveLength(tables.length);
    expect(new Set(active.map((s: { tableId: string }) => s.tableId)).size).toBe(tables.length);
    expect(new Set(listed.body.map((s: { sessionId: string }) => s.sessionId)).size).toBe(listed.body.length);

    for (const tableId of tables) {
      const ids = new Set(responses.map((r) => r.body.session).filter((s) => s.tableId === tableId).map((s) => s.sessionId));
      expect(ids.size).toBe(1);
    }
  });

  it('tras cerrar y reabrir, el listado no repite la mesa como activa (la cerrada no cuenta)', async () => {
    const first = await request(server).post('/sessions/staff-open').set(staff).send({ tableId: tables[0] });
    await request(server).patch(`/sessions/${first.body.session.sessionId}/close`).set(staff);
    const second = await request(server).post('/sessions/staff-open').set(staff).send({ tableId: tables[0] });
    expect(second.body.session.sessionId).not.toBe(first.body.session.sessionId);

    const listed = await request(server).get('/sessions').set(staff);
    const activeForTable = listed.body.filter((s: { tableId: string; status: string }) => s.tableId === tables[0] && s.status !== 'closed');
    expect(activeForTable).toHaveLength(1);
    expect(activeForTable[0].sessionId).toBe(second.body.session.sessionId);
  });
});
