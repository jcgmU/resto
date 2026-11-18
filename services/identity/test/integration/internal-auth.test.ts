import request from 'supertest';
import { createIdentityApp } from '../../src/app';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';

describe('Identity Internal Auth Middleware (R08)', () => {
  const origSecret = process.env.INTERNAL_SHARED_SECRET;
  let app: any;

  beforeAll(() => {
    process.env.INTERNAL_SHARED_SECRET = 'test-identity-secret-2026';
    app = createIdentityApp({
      tenantRepo: new InMemoryTenantRepository(),
      userRepo: new InMemoryUserRepository(),
      refreshTokenRepo: new InMemoryRefreshTokenRepository(),
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
    expect(res.body).toEqual({ status: 'ok', postgres: 'up' });
  });

  it('bloquea llamada sin token interno (401 UNAUTHORIZED)', async () => {
    const res = await request(app).get('/identity/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  });

  it('bloquea llamada con token interno incorrecto (401 UNAUTHORIZED)', async () => {
    const res = await request(app)
      .get('/identity/me')
      .set('x-internal-token', 'wrong-secret');
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
      .get('/identity/me')
      .set('x-internal-token', 'test-identity-secret-2026');
    // Passes internal auth, then reaches the route handler which validates identity headers
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Cabeceras de identidad requeridas',
      },
    });
  });

  describe('FAIL-CLOSED en ausencia de INTERNAL_SHARED_SECRET', () => {
    const origEnv = process.env.NODE_ENV;
    const origRequire = process.env.REQUIRE_INTERNAL_AUTH;
    const origSec = process.env.INTERNAL_SHARED_SECRET;

    afterEach(() => {
      process.env.INTERNAL_SHARED_SECRET = 'test-identity-secret-2026';
      if (origEnv !== undefined) process.env.NODE_ENV = origEnv; else delete process.env.NODE_ENV;
      if (origRequire !== undefined) process.env.REQUIRE_INTERNAL_AUTH = origRequire; else delete process.env.REQUIRE_INTERNAL_AUTH;
    });

    it('responde 500 INTERNAL_AUTH_MISCONFIGURED si falta secreto y REQUIRE_INTERNAL_AUTH=true', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.REQUIRE_INTERNAL_AUTH = 'true';
      const res = await request(app).get('/identity/me');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_AUTH_MISCONFIGURED');
    });

    it('responde 500 INTERNAL_AUTH_MISCONFIGURED si falta secreto y NODE_ENV=production', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.NODE_ENV = 'production';
      const res = await request(app).get('/identity/me');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_AUTH_MISCONFIGURED');
    });

    it('permite paso con warn en dev/test cuando no se exige secreto (escape dev)', async () => {
      delete process.env.INTERNAL_SHARED_SECRET;
      process.env.NODE_ENV = 'test';
      delete process.env.REQUIRE_INTERNAL_AUTH;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await request(app).get('/internal/tenant/tenant-default/settings');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[SECURITY WARN]'));
      expect(res.status).toBe(200);
      warnSpy.mockRestore();
    });
  });
});
