import request from 'supertest';
import { createSessionApp } from '../../src/app';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';

describe('Session Internal Auth Middleware (R08)', () => {
  const origSecret = process.env.INTERNAL_SHARED_SECRET;
  let app: any;

  beforeAll(() => {
    process.env.INTERNAL_SHARED_SECRET = 'test-session-secret-2026';
    app = createSessionApp({
      tableRepo: new InMemoryTableRepository(),
      sessionRepo: new InMemoryTableSessionRepository(),
    });
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
    expect(res.body).toEqual({ status: 'ok', redis: 'up' });
  });

  it('bloquea llamada sin token interno (401 UNAUTHORIZED)', async () => {
    const res = await request(app).get('/tables');
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
      .get('/tables')
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
      .get('/tables')
      .set('x-internal-token', 'test-session-secret-2026')
      .set('x-tenant-id', 'test-tenant')
      .set('x-user-role', 'staff');
    expect(res.status).toBe(200);
  });
});
