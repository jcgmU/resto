import request from 'supertest';
import { createIdentityApp } from '../../src/app';
import { PrismaTenantRepository } from '../../src/infrastructure/prisma/PrismaTenantRepository';
import { PrismaUserRepository } from '../../src/infrastructure/prisma/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/prisma/PrismaRefreshTokenRepository';
import {
  ensureContractEnv,
  getTestPrisma,
  truncateIdentityDb,
  disconnectTestPrisma,
} from './contract-helper';

describe('R07: Refresh Token Contract Test (Postgres Real: resto_identity_test)', () => {
  let app: any;
  const prisma = getTestPrisma();

  function authRequest(method: 'get' | 'post', path: string) {
    const req = request(app)[method](path);
    if (process.env.INTERNAL_SHARED_SECRET) {
      req.set('x-internal-token', process.env.INTERNAL_SHARED_SECRET);
    }
    return req;
  }

  beforeAll(async () => {
    await ensureContractEnv();
    app = createIdentityApp({
      tenantRepo: new PrismaTenantRepository(prisma),
      userRepo: new PrismaUserRepository(prisma),
      refreshTokenRepo: new PrismaRefreshTokenRepository(prisma),
    });
  });

  beforeEach(async () => {
    await truncateIdentityDb();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('1. Primer refresh con token válido devuelve 200 y nuevos tokens (access + refresh)', async () => {
    // 1. Crear tenant y admin mediante /auth/register
    const registerRes = await authRequest('post', '/auth/register').send({
      restaurantName: 'Bistro Refresh Contract',
      adminEmail: 'admin@bistro-refresh.com',
      adminPassword: 'Password123!',
      adminDisplayName: 'Admin Refresh',
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.tokens).toBeDefined();
    const initialRefreshToken = registerRes.body.tokens.refreshToken;
    expect(typeof initialRefreshToken).toBe('string');

    // 2. Ejecutar refresh con el token válido obtenido
    const refreshRes = await authRequest('post', '/auth/refresh').send({
      refreshToken: initialRefreshToken,
    });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(typeof refreshRes.body.accessToken).toBe('string');
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(typeof refreshRes.body.refreshToken).toBe('string');
    expect(refreshRes.body.refreshToken).not.toBe(initialRefreshToken);
    expect(refreshRes.body.expiresIn).toBe(900);
  });

  it('2. Reuso del token viejo ya rotado devuelve 401 INVALID_CREDENTIALS', async () => {
    // 1. Registro
    const registerRes = await authRequest('post', '/auth/register').send({
      restaurantName: 'Bistro Reuse Contract',
      adminEmail: 'admin@bistro-reuse.com',
      adminPassword: 'Password123!',
      adminDisplayName: 'Admin Reuse',
    });
    expect(registerRes.status).toBe(201);
    const initialRefreshToken = registerRes.body.tokens.refreshToken;

    // 2. Primer refresh exitoso (rota el token)
    const firstRefresh = await authRequest('post', '/auth/refresh').send({
      refreshToken: initialRefreshToken,
    });
    expect(firstRefresh.status).toBe(200);

    // 3. Reuso del token viejo ya rotado
    const reuseRes = await authRequest('post', '/auth/refresh').send({
      refreshToken: initialRefreshToken,
    });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: expect.any(String),
      },
    });
  });

  it('3. Doble llamada concurrente con el mismo refresh token (Promise.all): exactamente UNA pasa con 200 y la otra falla con 401', async () => {
    // 1. Registro
    const registerRes = await authRequest('post', '/auth/register').send({
      restaurantName: 'Bistro Concurrent Contract',
      adminEmail: 'admin@bistro-concurrent.com',
      adminPassword: 'Password123!',
      adminDisplayName: 'Admin Concurrent',
    });
    expect(registerRes.status).toBe(201);
    const validRefreshToken = registerRes.body.tokens.refreshToken;

    // 2. Disparar dos peticiones concurrentes exactamente con el mismo refreshToken
    const [resA, resB] = await Promise.all([
      authRequest('post', '/auth/refresh').send({ refreshToken: validRefreshToken }),
      authRequest('post', '/auth/refresh').send({ refreshToken: validRefreshToken }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 401]);

    const successRes = resA.status === 200 ? resA : resB;
    const failRes = resA.status === 401 ? resA : resB;

    expect(successRes.body.accessToken).toBeDefined();
    expect(successRes.body.refreshToken).toBeDefined();
    expect(successRes.body.refreshToken).not.toBe(validRefreshToken);

    expect(failRes.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: expect.any(String),
      },
    });
  });
});
