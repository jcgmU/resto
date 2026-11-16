import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PrismaClient } from '../src/generated/client';
import { createIdentityApp } from '../src/app';
import { PrismaTenantRepository } from '../src/infrastructure/prisma/PrismaTenantRepository';
import { PrismaUserRepository } from '../src/infrastructure/prisma/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../src/infrastructure/prisma/PrismaRefreshTokenRepository';

const sha256Hex = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

describe('U6 — Real Refresh Session Rotation & SHA-256 Hashing (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof createIdentityApp>;
  const createdTenantIds: string[] = [];
  const runSuffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0';

  beforeAll(async () => {
    const url = process.env.IDENTITY_DATABASE_URL;
    if (!url) {
      throw new Error(
        'Missing required env IDENTITY_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url },
      },
    });
    await prisma.$connect();

    app = createIdentityApp({
      tenantRepo: new PrismaTenantRepository(prisma),
      userRepo: new PrismaUserRepository(prisma),
      refreshTokenRepo: new PrismaRefreshTokenRepository(prisma),
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (createdTenantIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { tenantId: { in: createdTenantIds } },
          select: { id: true },
        });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
          await prisma.refreshToken.deleteMany({
            where: { userId: { in: userIds } },
          });
        }
        await prisma.user.deleteMany({
          where: { tenantId: { in: createdTenantIds } },
        });
        await prisma.tenant.deleteMany({
          where: { id: { in: createdTenantIds } },
        });
      }
      await prisma.$disconnect();
    }
  });

  it('a, c, d, e) register -> refresh 200 -> SHA-256 persisted in DB -> replay old token 401 -> sequential rotation with new token 200', async () => {
    const email = `u6-reg-${runSuffix}@resto.test`;
    const slug = `u6-reg-${runSuffix}`;

    const regRes = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Resto U6 Register',
        slug,
        adminEmail: email,
        adminPassword: 'Password123!',
        adminDisplayName: 'Admin U6',
      });

    expect(regRes.status).toBe(201);
    const tenantId: string = regRes.body.tenant.id;
    const userId: string = regRes.body.user.id;
    createdTenantIds.push(tenantId);

    const rt1: string = regRes.body.tokens.refreshToken;
    expect(typeof rt1).toBe('string');
    expect(rt1.length).toBeGreaterThan(16);

    // (c) Verify stored hash in PostgreSQL is real SHA-256 (64 hex chars), never raw or hash_${raw}
    const dbTokensAfterReg = await prisma.refreshToken.findMany({
      where: { userId },
    });
    expect(dbTokensAfterReg).toHaveLength(1);
    expect(dbTokensAfterReg[0].tokenHash).toBe(sha256Hex(rt1));
    expect(dbTokensAfterReg[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(dbTokensAfterReg[0].tokenHash).not.toBe(rt1);
    expect(dbTokensAfterReg[0].tokenHash).not.toBe(`hash_${rt1}`);
    expect(dbTokensAfterReg[0].revokedAt).toBeNull();

    // (a) Refresh with rt1 -> 200 with valid JWT claims and rotated refreshToken rt2
    const refresh1Res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rt1 });

    expect(refresh1Res.status).toBe(200);
    expect(refresh1Res.body.accessToken).toBeDefined();
    expect(refresh1Res.body.refreshToken).toBeDefined();
    expect(refresh1Res.body.refreshToken).not.toBe(rt1);

    const decoded = jwt.verify(refresh1Res.body.accessToken, jwtSecret) as any;
    expect(decoded.sub).toBe(userId);
    expect(decoded.tenantId).toBe(tenantId);
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.email).toBe(email);

    const rt2: string = refresh1Res.body.refreshToken;

    // Verify rt1 is now revoked in DB and rt2 is stored as SHA-256
    const oldTokenRecord = await prisma.refreshToken.findFirst({
      where: { userId, tokenHash: sha256Hex(rt1) },
    });
    expect(oldTokenRecord?.revokedAt).not.toBeNull();

    const newTokenRecord = await prisma.refreshToken.findFirst({
      where: { userId, tokenHash: sha256Hex(rt2) },
    });
    expect(newTokenRecord).not.toBeNull();
    expect(newTokenRecord?.revokedAt).toBeNull();

    // (d) Replay of old token rt1 -> 401 INVALID_CREDENTIALS
    const replayRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rt1 });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('INVALID_CREDENTIALS');

    // (e) Sequential rotation using rt2 -> 200 OK with rt3
    const refresh2Res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rt2 });
    expect(refresh2Res.status).toBe(200);
    expect(refresh2Res.body.accessToken).toBeDefined();
    expect(refresh2Res.body.refreshToken).toBeDefined();
    expect(refresh2Res.body.refreshToken).not.toBe(rt2);
  });

  it('b) login -> refresh 200 returns new access & refresh tokens', async () => {
    const email = `u6-login-${runSuffix}@resto.test`;
    const slug = `u6-login-${runSuffix}`;

    const regRes = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Resto U6 Login',
        slug,
        adminEmail: email,
        adminPassword: 'Password123!',
        adminDisplayName: 'Admin Login U6',
      });
    expect(regRes.status).toBe(201);
    createdTenantIds.push(regRes.body.tenant.id);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email,
        password: 'Password123!',
        tenantSlug: slug,
      });
    expect(loginRes.status).toBe(200);
    const loginRefreshToken: string = loginRes.body.tokens.refreshToken;

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(loginRefreshToken);
  });

  it('f, g, h) rejects expired token, revoked token, and token of DISABLED user with 401 INVALID_CREDENTIALS', async () => {
    const email = `u6-neg-${runSuffix}@resto.test`;
    const slug = `u6-neg-${runSuffix}`;

    const regRes = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Resto U6 Negative',
        slug,
        adminEmail: email,
        adminPassword: 'Password123!',
        adminDisplayName: 'Admin Neg U6',
      });
    expect(regRes.status).toBe(201);
    const tenantId: string = regRes.body.tenant.id;
    const userId: string = regRes.body.user.id;
    createdTenantIds.push(tenantId);

    // (f) Expired refresh token in DB -> 401 INVALID_CREDENTIALS
    const rawExpired = `expired-raw-${runSuffix}`;
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(rawExpired),
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: null,
      },
    });

    const expiredRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rawExpired });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe('INVALID_CREDENTIALS');

    // (g) Revoked refresh token in DB -> 401 INVALID_CREDENTIALS
    const rawRevoked = `revoked-raw-${runSuffix}`;
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(rawRevoked),
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: new Date(),
      },
    });

    const revokedRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rawRevoked });
    expect(revokedRes.status).toBe(401);
    expect(revokedRes.body.error.code).toBe('INVALID_CREDENTIALS');

    // (h) User with status DISABLED in DB (even with valid unrevoked, unexpired refresh token) -> 401 INVALID_CREDENTIALS
    const rawDisabledUser = `disabled-user-raw-${runSuffix}`;
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(rawDisabledUser),
        expiresAt: new Date(Date.now() + 3600_000),
        revokedAt: null,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'DISABLED' },
    });

    const disabledUserRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rawDisabledUser });
    expect(disabledUserRes.status).toBe(401);
    expect(disabledUserRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(disabledUserRes.body.error.message).toBe('Sesión inválida o usuario inactivo');
  });
});
