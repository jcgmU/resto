import request from 'supertest';
import { createSeededOrderingTestApp } from '../helpers/seededOrderingApp';

describe('Ordering Internal Auth Middleware (R08)', () => {
  const origSecret = process.env.INTERNAL_SHARED_SECRET;
  let app: any;

  beforeAll(() => {
    process.env.INTERNAL_SHARED_SECRET = 'test-ordering-secret-2026';
    app = createSeededOrderingTestApp();
  });

  afterAll(() => {
    if (origSecret !== undefined) {
      process.env.INTERNAL_SHARED_SECRET = origSecret;
    } else {
      delete process.env.INTERNAL_SHARED_SECRET;
    }
  });

  it('exenta /health (200)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', postgres: 'up', redis: 'up' });
  });

  it('bloquea llamada sin token interno (401 UNAUTHORIZED)', async () => {
    const res = await request(app).get('/checkout/s-smoke-e2e');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  });

  it('bloquea llamada con token interno inválido (401 UNAUTHORIZED)', async () => {
    const res = await request(app)
      .get('/checkout/s-smoke-e2e')
      .set('x-internal-token', 'wrong-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  });

  it('permite llamada con token interno válido', async () => {
    const res = await request(app)
      .get('/checkout/s-smoke-e2e')
      .set('x-internal-token', 'test-ordering-secret-2026')
      .set('x-tenant-id', 't-smoke-e2e')
      .set('x-user-role', 'staff');
    expect(res.status).toBe(200);
  });
});
