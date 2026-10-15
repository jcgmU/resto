import {
  ensureContractEnv,
  getTestRedis,
  flushSessionRedis,
  disconnectTestRedis,
} from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
  RequestBillSessionUseCaseImpl,
  ReopenBillSessionUseCaseImpl,
} from '../../src/application/SessionUseCases';
import { JwtGuestTokenIssuer } from '../../src/infrastructure/security/JwtGuestTokenIssuer';
import { createSessionApp } from '../../src/app';
import request from 'supertest';

describe('R03a Transiciones de Estado de Sesión (Contract Test con Redis Real db2)', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let tokenIssuer: JwtGuestTokenIssuer;
  let openUseCase: OpenTableSessionUseCaseImpl;
  let closeUseCase: CloseTableSessionUseCaseImpl;
  let requestBillUseCase: RequestBillSessionUseCaseImpl;
  let reopenBillUseCase: ReopenBillSessionUseCaseImpl;
  let app: any;

  const tenantId = 'tenant-transition-test';
  const tableId = 'table-trans-1';
  const qrKey = 'valid-transition-qr-key';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    tokenIssuer = new JwtGuestTokenIssuer('contract-test-secret');

    openUseCase = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);
    closeUseCase = new CloseTableSessionUseCaseImpl(sessionRepo);
    requestBillUseCase = new RequestBillSessionUseCaseImpl(sessionRepo);
    reopenBillUseCase = new ReopenBillSessionUseCaseImpl(sessionRepo);

    app = createSessionApp({
      tableRepo,
      sessionRepo,
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
      label: 'Mesa Transiciones 1',
      status: 'active',
      qrKey,
      createdAt: new Date().toISOString(),
    });
  });

  test('Flujo válido completo: active -> bill-request (200) -> bill-reopen (200) -> bill-request (200) -> close (200)', async () => {
    // 1. Abrir sesión inicial -> active
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    expect(openRes.status).toBe(200);
    const sessionId = openRes.body.session.sessionId;
    expect(openRes.body.session.status).toBe('active');

    // 2. active -> bill-request -> billRequested (200)
    const billReqRes = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    expect(billReqRes.status).toBe(200);
    expect(billReqRes.body.status).toBe('billRequested');
    expect(billReqRes.body.billRequestedAt).toBeDefined();

    // Verificar en Redis real: status persistido y puntero conservado
    const sessionInRedis1 = await sessionRepo.findById(tenantId, sessionId);
    expect(sessionInRedis1?.status).toBe('billRequested');
    expect(sessionInRedis1?.billRequestedAt).toBeDefined();

    const pointerVal1 = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointerVal1).toBe(sessionId);

    // Idempotencia: segundo bill-request mientras está en billRequested devuelve 200
    const billReqIdemp = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    expect(billReqIdemp.status).toBe(200);
    expect(billReqIdemp.body.status).toBe('billRequested');

    // 3. billRequested -> bill-reopen -> active (200) por staff
    const reopenRes = await request(app)
      .post(`/sessions/${sessionId}/bill-reopen`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.status).toBe('active');
    expect(reopenRes.body.billRequestedAt).toBeUndefined();

    // Verificar en Redis real: status 'active' y billRequestedAt borrado
    const sessionInRedis2 = await sessionRepo.findById(tenantId, sessionId);
    expect(sessionInRedis2?.status).toBe('active');
    expect(sessionInRedis2?.billRequestedAt).toBeUndefined();

    const pointerVal2 = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointerVal2).toBe(sessionId);

    // 4. active -> bill-request de nuevo -> billRequested (200)
    const billReqRes2 = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    expect(billReqRes2.status).toBe(200);
    expect(billReqRes2.body.status).toBe('billRequested');

    // 5. billRequested -> close -> closed (200)
    const closeRes = await request(app)
      .patch(`/sessions/${sessionId}/close`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe('closed');
    expect(closeRes.body.closedAt).toBeDefined();

    // Verificar en Redis real: status 'closed' y puntero eliminado
    const sessionInRedis3 = await sessionRepo.findById(tenantId, sessionId);
    expect(sessionInRedis3?.status).toBe('closed');

    const pointerVal3 = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointerVal3).toBeNull();
  });

  test('Cierre directo desde active -> close -> closed (200)', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;
    expect(openRes.body.session.status).toBe('active');

    const closeRes = await request(app)
      .post(`/sessions/${sessionId}/close`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'manager');

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe('closed');
    expect(closeRes.body.closedAt).toBeDefined();

    const pointerVal = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointerVal).toBeNull();
  });

  test('Rechazo de transiciones inválidas: closed -> bill-request -> error/400', async () => {
    // Abrir y cerrar sesión
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    await request(app)
      .patch(`/sessions/${sessionId}/close`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    // Intentar solicitar cuenta sobre sesión cerrada
    const invalidReq = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    expect(invalidReq.status).toBe(400);
    expect(invalidReq.body.error).toBeDefined();
    expect(invalidReq.body.error.code).toBe('INVALID_SESSION_STATE');
  });

  test('Rechazo de transiciones inválidas: active -> bill-reopen -> error/400', async () => {
    // Abrir sesión (queda en active)
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    // Intentar reabrir una cuenta que ya está en active
    const invalidReopen = await request(app)
      .post(`/sessions/${sessionId}/bill-reopen`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(invalidReopen.status).toBe(400);
    expect(invalidReopen.body.error).toBeDefined();
    expect(invalidReopen.body.error.code).toBe('INVALID_SESSION_STATE');
  });

  test('Rechazo de transiciones inválidas: closed -> bill-reopen -> error/400', async () => {
    // Abrir y cerrar sesión
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    await request(app)
      .patch(`/sessions/${sessionId}/close`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    // Intentar reabrir cuenta sobre sesión cerrada
    const invalidReopen = await request(app)
      .post(`/sessions/${sessionId}/bill-reopen`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(invalidReopen.status).toBe(400);
    expect(invalidReopen.body.error).toBeDefined();
    expect(invalidReopen.body.error.code).toBe('INVALID_SESSION_STATE');
  });

  test('Control de acceso: POST bill-reopen sin rol de staff -> 403', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    // Solicitar cuenta
    await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    // Intentar reabrir como guest o sin rol
    const noRoleRes = await request(app)
      .post(`/sessions/${sessionId}/bill-reopen`)
      .set('x-tenant-id', tenantId);

    expect(noRoleRes.status).toBe(403);

    const guestRoleRes = await request(app)
      .post(`/sessions/${sessionId}/bill-reopen`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'guest');

    expect(guestRoleRes.status).toBe(403);
  });

  test('Control de acceso: POST bill-request con guest mismatch -> 403', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    // Intentar pedir la cuenta con un x-session-id ajeno
    const forbiddenRes = await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', 'foreign-session-id');

    expect(forbiddenRes.status).toBe(403);
  });

  test('Mesa ocupada en billRequested: escaneo concurrente/nuevo QR devuelve la misma sesión', async () => {
    const openRes = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    const sessionId = openRes.body.session.sessionId;

    // Cambiar a billRequested
    await request(app)
      .post(`/sessions/${sessionId}/bill-request`)
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId);

    // Nuevo escaneo de QR mientras la mesa está en billRequested
    const secondScan = await request(app)
      .post('/sessions/open')
      .send({ tenantId, tableId, qrKey });

    expect(secondScan.status).toBe(200);
    expect(secondScan.body.session.sessionId).toBe(sessionId);
    expect(secondScan.body.session.status).toBe('billRequested');
  });

  test('Repositorio directo: requestBill y reopenBill persisten en Redis y lanzan DomainError', async () => {
    // Guardar sesión activa directamente en repo
    const created = await sessionRepo.save(
      tenantId,
      {
        sessionId: 'repo-direct-sess-1',
        tenantId,
        tableId,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      3600
    );

    // requestBill
    const billReq = await sessionRepo.requestBill(tenantId, created.sessionId);
    expect(billReq.status).toBe('billRequested');
    expect(billReq.billRequestedAt).toBeDefined();

    // Re-request directo en repo cuando ya es billRequested -> rechaza
    await expect(
      sessionRepo.requestBill(tenantId, created.sessionId)
    ).rejects.toThrow('No se puede solicitar la cuenta');

    // reopenBill
    const reopened = await sessionRepo.reopenBill(tenantId, created.sessionId);
    expect(reopened.status).toBe('active');
    expect(reopened.billRequestedAt).toBeUndefined();

    // Reopen directo en repo cuando ya es active -> rechaza
    await expect(
      sessionRepo.reopenBill(tenantId, created.sessionId)
    ).rejects.toThrow('No se puede reabrir la cuenta');
  });
});
