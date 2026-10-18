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

  describe('FAIL-CLOSED en ausencia de INTERNAL_SHARED_SECRET', () => {
    const origEnv = process.env.NODE_ENV;
    const origRequire = process.env.REQUIRE_INTERNAL_AUTH;

    afterEach(() => {
      process.env.INTERNAL_SHARED_SECRET = 'test-session-secret-2026';
      if (origEnv !== undefined) process.env.NODE_ENV = origEnv; else delete process.env.NODE_ENV;
      if (origRequire !== undefined) process.env.REQUIRE_INTERNAL_AUTH = origRequire; else delete process.env.REQUIRE_INTERNAL_AUTH;
    });

    it('responde 500 INTERNAL_AUTH_MISCONFIGURED si falta secreto y REQUIRE_INTERNAL_AUTH=true', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.REQUIRE_INTERNAL_AUTH = 'true';
      const res = await request(app).get('/tables');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_AUTH_MISCONFIGURED');
    });

    it('responde 500 INTERNAL_AUTH_MISCONFIGURED si falta secreto y NODE_ENV=production', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.NODE_ENV = 'production';
      const res = await request(app).get('/tables');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_AUTH_MISCONFIGURED');
    });

    it('permite paso con warn en dev/test cuando no se exige secreto (escape dev)', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.NODE_ENV = 'test';
      delete process.env.REQUIRE_INTERNAL_AUTH;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await request(app)
        .get('/tables')
        .set('x-tenant-id', 'test-tenant')
        .set('x-user-role', 'staff');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[SECURITY WARN]'));
      expect(res.status).toBe(200);
      warnSpy.mockRestore();
    });
  });
});
