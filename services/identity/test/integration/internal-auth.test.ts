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
});
