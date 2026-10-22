import request from 'supertest';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';

const TEST_SECRET = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = TEST_SECRET;
process.env.INTERNAL_SHARED_SECRET = 'resto-internal-shared-secret-dev-2026';
process.env.IDENTITY_SERVICE_URL = 'http://localhost:4001';
process.env.CATALOG_SERVICE_URL = 'http://localhost:4002';
process.env.SESSION_SERVICE_URL = 'http://localhost:4003';
process.env.ORDERING_SERVICE_URL = 'http://localhost:4004';

describe('ADR Permisos Perfil Cajero (CASHIER) - Matriz de Autorización', () => {
  let app: any;
  const cashierToken = jwt.sign(
    { userId: 'cashier-1', tenantId: 'tenant-1', role: 'cashier' },
    TEST_SECRET
  );

  beforeEach(() => {
    nock.cleanAll();
    app = createApp();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Rutas PERMITIDAS para CASHIER (según ADR 2026-10-21)', () => {
    test('GET /v1/tables -> 200 (autorizado para ver mesas)', async () => {
      nock('http://localhost:4003').get('/tables').reply(200, [{ id: 'table-1' }]);
      const res = await request(app)
        .get('/v1/tables')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('GET /v1/sessions -> 200 (autorizado para ver sesiones activas)', async () => {
      nock('http://localhost:4003').get('/sessions').reply(200, [{ sessionId: 'sess-1' }]);
      const res = await request(app)
        .get('/v1/sessions')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('GET /v1/checkout/:sessionId -> 200 (autorizado para consultar cuenta)', async () => {
      nock('http://localhost:4004').get('/checkout/sess-1').reply(200, { total: 15000 });
      const res = await request(app)
        .get('/v1/checkout/sess-1')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('POST /v1/checkout/confirm -> 200 (autorizado para registrar cobro y liberar)', async () => {
      nock('http://localhost:4004').post('/checkout/confirm').reply(200, { status: 'paid' });
      const res = await request(app)
        .post('/v1/checkout/confirm')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ sessionId: 'sess-1', method: 'CARD' });
      expect(res.status).toBe(200);
    });

    test('POST /v1/checkout/:sessionId/retry-invoice -> 200 (autorizado para reintentar emisión de factura)', async () => {
      nock('http://localhost:4004').post('/checkout/sess-1/retry-invoice').reply(200, { invoiceStatus: 'pending' });
      const res = await request(app)
        .post('/v1/checkout/sess-1/retry-invoice')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('PATCH /v1/sessions/:id/close -> 200 (autorizado para cerrar sesión sin consumo)', async () => {
      nock('http://localhost:4003').patch('/sessions/sess-1/close').reply(200, { status: 'closed' });
      const res = await request(app)
        .patch('/v1/sessions/sess-1/close')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('GET /v1/service-calls -> 200 (autorizado para ver llamadas de servicio)', async () => {
      nock('http://localhost:4004').get('/service-calls').reply(200, []);
      const res = await request(app)
        .get('/v1/service-calls')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });

    test('PATCH /v1/service-calls/:id/resolve -> 200 (autorizado para resolver llamadas)', async () => {
      nock('http://localhost:4004').patch('/service-calls/call-1/resolve').reply(200, { status: 'resolved' });
      const res = await request(app)
        .patch('/v1/service-calls/call-1/resolve')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Rutas DENEGADAS para CASHIER (403 FORBIDDEN, según ADR 2026-10-21)', () => {
    test('POST /v1/sessions/:id/bill-reopen -> 403 (caja NO puede reabrir cuentas)', async () => {
      const res = await request(app)
        .post('/v1/sessions/sess-1/bill-reopen')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('POST /v1/sessions/staff-open -> 403 (caja NO abre mesas para comanda)', async () => {
      const res = await request(app)
        .post('/v1/sessions/staff-open')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ tableId: 't1' });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('PATCH /v1/orders/:id/delay -> 403 (caja NO asigna demoras de KDS)', async () => {
      const res = await request(app)
        .patch('/v1/orders/ord-1/delay')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ delayMinutes: 10 });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('PATCH /v1/orders/:id/status -> 403 (caja NO avanza estados de cocina)', async () => {
      const res = await request(app)
        .patch('/v1/orders/ord-1/status')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ status: 'READY' });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('PATCH /v1/tenant/settings -> 403 (caja NO toca configuración ni ajustes)', async () => {
      const res = await request(app)
        .patch('/v1/tenant/settings')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ operatingMode: 'waiter_only' });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('POST /v1/identity/users -> 403 (caja NO gestiona empleados)', async () => {
      const res = await request(app)
        .post('/v1/identity/users')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ email: 'nuevo@resto.com' });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });
  });
});
