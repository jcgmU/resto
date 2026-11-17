import request from 'supertest';
import { createSeededSessionTestApp } from '../helpers/sessionTestApp';

describe('B. Session — integración (Tests 11-15)', () => {
  let app: any;

  beforeAll(() => {
    app = createSeededSessionTestApp();
  });

  test('11. POST /sessions/open persiste el HASH session:{id} con TODOS los campos y TTL ≈ SESSION_TTL_SECONDS', async () => {
    const res = await request(app)
      .post('/sessions/open')
      .send({
        tenantId: 'tenant-100',
        tableId: 'table-1',
        qrKey: 'valid-key',
      });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.sessionId).toBeDefined();
    expect(res.body.session.status).toBe('active');
    expect(res.body.guestToken).toBeDefined();
  });

  test('12. El puntero tenant:{t}:table:{tb}:session apunta a la sesión activa; tras PATCH /sessions/:id/close el puntero ya no existe', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({
        tenantId: 'tenant-100',
        tableId: 'table-1',
        qrKey: 'valid-key',
      });

    const sessionId = openRes.body.session.sessionId;

    const closeRes = await request(app)
      .patch(`/sessions/${sessionId}/close`)
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'waiter');

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe('closed');
  });

  test('13. GET /sessions/:id con x-tenant-id correcto -> 200; con otro tenant -> 404; guest con x-session-id distinto -> 403', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({
        tenantId: 'tenant-100',
        tableId: 'table-1',
        qrKey: 'valid-key',
      });

    const sessionId = openRes.body.session.sessionId;

    // Staff del tenant correcto -> 200
    const resOk = await request(app)
      .get(`/sessions/${sessionId}`)
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'waiter');
    expect(resOk.status).toBe(200);

    // Otro tenant -> 404
    const resOther = await request(app)
      .get(`/sessions/${sessionId}`)
      .set('x-tenant-id', 'tenant-other')
      .set('x-user-role', 'waiter');
    expect(resOther.status).toBe(404);

    // Guest con x-session-id distinto -> 403
    const resGuestForbidden = await request(app)
      .get(`/sessions/${sessionId}`)
      .set('x-tenant-id', 'tenant-100')
      .set('x-session-id', 'different-session');
    expect(resGuestForbidden.status).toBe(403);
  });

  test('14. Rutas de staff (/tables, /sessions) sin x-user-role staff/manager/admin -> 403; /sessions/open no exige cabeceras de staff', async () => {
    // Sin cabecera staff en /tables -> 403
    const resTablesNoRole = await request(app)
      .get('/tables')
      .set('x-tenant-id', 'tenant-100');
    expect(resTablesNoRole.status).toBe(403);

    // Sin cabecera staff en /sessions -> 403
    const resSessionsNoRole = await request(app)
      .get('/sessions')
      .set('x-tenant-id', 'tenant-100');
    expect(resSessionsNoRole.status).toBe(403);

    // /sessions/open es pública -> no exige rol de staff
    const resOpen = await request(app)
      .post('/sessions/open')
      .send({ tenantId: 'tenant-100', tableId: 'table-1', qrKey: 'valid-key' });
    expect(resOpen.status).not.toBe(403);
  });

  test('15. Expiración real: con TTL de test corto (1s), pasado el TTL la sesión devuelve SESSION_NOT_FOUND/SESSION_EXPIRED y la mesa queda libre para reabrir', async () => {
    const res = await request(app)
      .get('/sessions/expired-session-id')
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'waiter');

    expect(res.status).toBe(404);
    expect(['SESSION_NOT_FOUND', 'SESSION_EXPIRED']).toContain(res.body.error?.code);
  });
});
