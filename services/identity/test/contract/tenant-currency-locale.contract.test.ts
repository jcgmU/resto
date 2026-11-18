import request from 'supertest';
import { createIdentityApp } from '../../src/app';
import { PrismaTenantRepository } from '../../src/infrastructure/prisma/PrismaTenantRepository';
import { PrismaUserRepository } from '../../src/infrastructure/prisma/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/prisma/PrismaRefreshTokenRepository';
import { ensureContractEnv, getTestPrisma, truncateIdentityDb, disconnectTestPrisma } from './contract-helper';

describe('Moneda y locale por tenant (Postgres real: resto_identity_test)', () => {
  let app: any;
  const prisma = getTestPrisma();
  let tenantRepo: PrismaTenantRepository;
  const origSecret = process.env.INTERNAL_SHARED_SECRET;

  function call(method: 'get' | 'patch', path: string) {
    const req = request(app)[method](path);
    req.set('x-internal-token', process.env.INTERNAL_SHARED_SECRET as string);
    return req;
  }

  async function createTenant(id: string) {
    return tenantRepo.save({
      id,
      name: 'Resto Moneda',
      slug: `resto-moneda-${id}`,
      status: 'ACTIVE',
      operatingMode: 'hybrid',
      estimatedPrepMinutes: 18,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  beforeAll(async () => {
    process.env.INTERNAL_SHARED_SECRET = 'test-internal-secret-currency';
    await ensureContractEnv();
    tenantRepo = new PrismaTenantRepository(prisma);
    app = createIdentityApp({
      tenantRepo,
      userRepo: new PrismaUserRepository(prisma),
      refreshTokenRepo: new PrismaRefreshTokenRepository(prisma),
      prisma,
    });
  });

  beforeEach(async () => {
    await truncateIdentityDb();
  });

  afterAll(async () => {
    if (origSecret !== undefined) process.env.INTERNAL_SHARED_SECRET = origSecret;
    else delete process.env.INTERNAL_SHARED_SECRET;
    await disconnectTestPrisma();
  });

  it('un tenant nuevo queda COP / es-CO y todos los GET lo devuelven', async () => {
    const tenant = await createTenant('t-defaults');
    const inDb = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(inDb).toMatchObject({ currency: 'COP', locale: 'es-CO' });

    const staff = await call('get', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', 'WAITER');
    expect(staff.status).toBe(200);
    expect(staff.body).toMatchObject({ operatingMode: 'hybrid', estimatedPrepMinutes: 18, currency: 'COP', locale: 'es-CO' });

    const internal = await call('get', `/internal/tenant/${tenant.id}/settings`);
    expect(internal.body).toMatchObject({ currency: 'COP', locale: 'es-CO', estimatedPrepMinutes: 18 });
  });

  it('el invitado y el endpoint público ven moneda y locale pero no prep ni invoice', async () => {
    const tenant = await createTenant('t-public');
    await prisma.tenant.update({ where: { id: tenant.id }, data: { currency: 'USD', locale: 'en-US' } });

    const guest = await call('get', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', 'guest');
    expect(guest.body).toEqual({ operatingMode: 'hybrid', currency: 'USD', locale: 'en-US' });

    const publicRes = await call('get', `/v1/public/tenants/${tenant.id}/settings`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body).toEqual({ operatingMode: 'hybrid', currency: 'USD', locale: 'en-US' });
    expect(Object.keys(publicRes.body)).not.toContain('estimatedPrepMinutes');
    expect(Object.keys(publicRes.body)).not.toContain('invoiceMode');
  });

  it('PATCH válido (admin y manager) persiste, devuelve ambos campos y permite cambiar solo uno', async () => {
    const tenant = await createTenant('t-patch');
    const admin = await call('patch', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', 'ADMIN').send({ currency: 'USD', locale: 'en-US' });
    expect(admin.status).toBe(200);
    expect(admin.body).toMatchObject({ currency: 'USD', locale: 'en-US' });

    const manager = await call('patch', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', 'manager').send({ currency: 'EUR' });
    expect(manager.status).toBe(200);
    expect(manager.body).toMatchObject({ currency: 'EUR', locale: 'en-US' });

    const inDb = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(inDb).toMatchObject({ currency: 'EUR', locale: 'en-US' });
  });

  it('PATCH con moneda o locale inválidos responde 400 y no cambia nada', async () => {
    const tenant = await createTenant('t-invalid');
    const bodies = [
      { currency: 'cop' },
      { currency: 'XXXX' },
      { currency: 'ZZZ' },
      { currency: 123 },
      { currency: '' },
      { locale: 'es_CO' },
      { locale: '' },
      { locale: 'no valido' },
      { locale: 5 },
      { currency: 'USD', locale: 'es_CO' },
    ];
    for (const body of bodies) {
      const res = await call('patch', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', 'ADMIN').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const inDb = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(inDb).toMatchObject({ currency: 'COP', locale: 'es-CO' });
  });

  it('PATCH con mesero, cajero o monitor responde 403', async () => {
    const tenant = await createTenant('t-forbidden');
    for (const role of ['WAITER', 'CASHIER', 'MONITOR']) {
      const res = await call('patch', '/v1/tenant/settings').set('x-tenant-id', tenant.id).set('x-user-role', role).send({ currency: 'USD' });
      expect(res.status).toBe(403);
    }
  });
});
