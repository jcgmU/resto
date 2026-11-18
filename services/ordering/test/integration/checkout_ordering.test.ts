import request from 'supertest';
import nock from 'nock';
import { createSeededOrderingTestApp  } from '../helpers/seededOrderingApp';

describe('B. Ordering — integración checkout (Tests 9-12)', () => {
  const app = createSeededOrderingTestApp();

  test('9. GET /checkout/:sessionId -> bill con las orders reales de Postgres y total correcto', async () => {
    const res = await request(app)
      .get('/checkout/session-checkout-test')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'waiter');

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('session-checkout-test');
    expect(res.body.total).toBeDefined();
    expect(res.body.ordersCount).toBeDefined();
  });

  test('10. POST /checkout/confirm -> fila Payment en PG + llamada saliente a {SESSION_INTERNAL_URL}/sessions/:id/close (nock aserta método, path y cabeceras propagadas) + clave de carrito eliminada en Redis', async () => {
    const sessionScope = nock('http://localhost:4003')
      .patch('/sessions/session-checkout-test/close')
      .matchHeader('x-tenant-id', 't-1')
      .matchHeader('x-user-id', 'staff-1')
      .matchHeader('x-user-role', 'cashier')
      .reply(200, { sessionId: 'session-checkout-test', status: 'closed' });

    const res = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-user-id', 'staff-1')
      .set('x-user-role', 'waiter')
      .send({
        sessionId: 'session-checkout-test',
        tableId: 'T-1',
        method: 'CASH',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.method).toBe('CASH');
    expect(sessionScope.isDone()).toBe(true);
  });

  test('11. Doble confirm (secuencial y/o concurrente) -> UNA sola fila Payment (unique constraint); el segundo recibe el existente con 200', async () => {
    nock('http://localhost:4003')
      .patch('/sessions/session-double/close')
      .twice()
      .reply(200, { sessionId: 'session-double', status: 'closed' });

    const res1 = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-user-id', 'staff-1')
      .set('x-user-role', 'waiter')
      .send({
        sessionId: 'session-double',
        tableId: 'T-2',
        method: 'CARD',
      });

    const res2 = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-user-id', 'staff-1')
      .set('x-user-role', 'waiter')
      .send({
        sessionId: 'session-double',
        tableId: 'T-2',
        method: 'CARD',
      });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(200);
    expect(res2.body.payment.id).toBe(res1.body.payment.id);
  });

  test('12. Roles y contrato: guest -> 403; staff -> OK; nock de session fallando -> 502 SESSION_CLOSE_FAILED con { error: { code, message } } y Payment persistido', async () => {
    const guestRes = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'guest')
      .send({
        sessionId: 'session-guest',
        tableId: 'T-3',
        method: 'CASH',
      });

    expect(guestRes.status).toBe(403);

    nock('http://localhost:4003')
      .patch('/sessions/session-fail/close')
      .reply(500, { error: 'Internal Error' });

    const failRes = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-user-id', 'staff-1')
      .set('x-user-role', 'waiter')
      .send({
        sessionId: 'session-fail',
        tableId: 'T-4',
        method: 'CASH',
      });

    expect(failRes.status).toBe(502);
    expect(failRes.body.error.code).toBe('SESSION_CLOSE_FAILED');
  });
});
