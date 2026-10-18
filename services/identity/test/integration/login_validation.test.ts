import request from 'supertest';
import { createIdentityApp } from '../../src/app';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';

describe('POST /auth/login - Validation (F4)', () => {
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
    delete process.env.INTERNAL_SHARED_SECRET;
  });

  test('POST /auth/login con body {} responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-internal-token', 'test-identity-secret-2026')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/requeridos/i);
  });

  test('POST /auth/login con email vacío o solo espacios responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-internal-token', 'test-identity-secret-2026')
      .send({ email: '   ', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /auth/login sin password responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-internal-token', 'test-identity-secret-2026')
      .send({ email: 'admin@resto.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
