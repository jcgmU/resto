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

describe('V16: Tenant Settings Contract Test (Postgres Real: resto_identity_test)', () => {
  let app: any;
  const prisma = getTestPrisma();
  let tenantRepo: PrismaTenantRepository;

  function authRequest(method: 'get' | 'patch', path: string) {
    const req = request(app)[method](path);
    if (process.env.INTERNAL_SHARED_SECRET) {
      req.set('x-internal-token', process.env.INTERNAL_SHARED_SECRET);
    }
    return req;
  }

  beforeAll(async () => {
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
    await disconnectTestPrisma();
  });

  async function createTestTenant(id = 'tenant-test-settings') {
    return tenantRepo.save({
      id,
      name: 'Resto Test Settings',
      slug: `resto-test-${id}`,
      status: 'ACTIVE',
      operatingMode: 'hybrid',
      estimatedPrepMinutes: 18,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  describe('GET /tenant/settings y /v1/tenant/settings', () => {
    it('GET con staff (ADMIN, MANAGER, STAFF, WAITER) devuelve configuración completa (operatingMode y estimatedPrepMinutes)', async () => {
      const tenant = await createTestTenant('tenant-staff-check');

      for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER', 'admin', 'waiter']) {
        const res = await authRequest('get', '/tenant/settings')
          .set('x-tenant-id', tenant.id)
          .set('x-user-role', role);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          operatingMode: 'hybrid',
          estimatedPrepMinutes: 18,
        });
        expect(res.body.operatingMode).toBe('hybrid');
        expect(res.body.estimatedPrepMinutes).toBe(18);
      }

      // Probar también ruta /v1/tenant/settings
      const v1Res = await authRequest('get', '/v1/tenant/settings')
        .set('x-tenant-id', tenant.id)
        .set('x-user-role', 'ADMIN');

      expect(v1Res.status).toBe(200);
      expect(v1Res.body).toEqual({
        operatingMode: 'hybrid',
        estimatedPrepMinutes: 18,
      });
    });

    it('GET con guest (o sin rol staff) devuelve ÚNICAMENTE operatingMode (GUEST NUNCA DEBE VER estimatedPrepMinutes)', async () => {
      const tenant = await createTestTenant('tenant-guest-check');

      const guestScenarios = [
        { desc: 'rol guest explícito', headers: { 'x-tenant-id': tenant.id, 'x-user-role': 'guest' } },
        { desc: 'rol CUSTOMER', headers: { 'x-tenant-id': tenant.id, 'x-user-role': 'CUSTOMER' } },
        { desc: 'sin cabecera x-user-role', headers: { 'x-tenant-id': tenant.id } },
        { desc: 'rol desconocido', headers: { 'x-tenant-id': tenant.id, 'x-user-role': 'UNKNOWN' } },
      ];

      for (const scenario of guestScenarios) {
        const req = authRequest('get', '/tenant/settings');
        for (const [key, value] of Object.entries(scenario.headers)) {
          req.set(key, value);
        }
        const res = await req;

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          operatingMode: 'hybrid',
        });
        expect(res.body.estimatedPrepMinutes).toBeUndefined();
        expect(Object.keys(res.body)).not.toContain('estimatedPrepMinutes');
      }
    });

    it('GET sin tenantId devuelve 400 VALIDATION_ERROR', async () => {
      const res = await authRequest('get', '/tenant/settings');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET con tenant inexistente devuelve 404 NOT_FOUND', async () => {
      const res = await authRequest('get', '/tenant/settings')
        .set('x-tenant-id', 'tenant-no-existe');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /tenant/settings y /v1/tenant/settings', () => {
    it('PATCH con valores válidos (ADMIN o MANAGER) actualiza y persiste en Postgres real', async () => {
      const tenant = await createTestTenant('tenant-patch-valid');

      // 1. ADMIN actualiza operatingMode y estimatedPrepMinutes
      const patchRes = await authRequest('patch', '/tenant/settings')
        .set('x-tenant-id', tenant.id)
        .set('x-user-role', 'ADMIN')
        .send({
          operatingMode: 'waiter_only',
          estimatedPrepMinutes: 25,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body).toEqual({
        operatingMode: 'waiter_only',
        estimatedPrepMinutes: 25,
      });

      // 2. Verificar persistencia REAL en PostgreSQL
      const inDb = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(inDb).not.toBeNull();
      expect(inDb!.operatingMode).toBe('waiter_only');
      expect(inDb!.estimatedPrepMinutes).toBe(25);

      // 3. Verificar que GET guest refleja el nuevo operatingMode y sigue sin ver estimatedPrepMinutes
      const guestGet = await authRequest('get', '/tenant/settings')
        .set('x-tenant-id', tenant.id)
        .set('x-user-role', 'guest');
      expect(guestGet.status).toBe(200);
      expect(guestGet.body).toEqual({
        operatingMode: 'waiter_only',
      });
      expect(guestGet.body.estimatedPrepMinutes).toBeUndefined();

      // 4. MANAGER actualiza solo estimatedPrepMinutes a través de /v1/tenant/settings
      const managerPatch = await authRequest('patch', '/v1/tenant/settings')
        .set('x-tenant-id', tenant.id)
        .set('x-user-role', 'MANAGER')
        .send({
          estimatedPrepMinutes: 45,
        });

      expect(managerPatch.status).toBe(200);
      expect(managerPatch.body).toEqual({
        operatingMode: 'waiter_only',
        estimatedPrepMinutes: 45,
      });

      const inDbAfterManager = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(inDbAfterManager!.operatingMode).toBe('waiter_only');
      expect(inDbAfterManager!.estimatedPrepMinutes).toBe(45);
    });

    it('PATCH con estimatedPrepMinutes fuera de rango (ej. 3 o 150) o tipo inválido responde 400 VALIDATION_ERROR', async () => {
      const tenant = await createTestTenant('tenant-prep-range');

      const invalidPayloads = [
        { prep: 3, label: 'menor a 5' },
        { prep: 0, label: 'cero' },
        { prep: -10, label: 'negativo' },
        { prep: 121, label: 'mayor a 120' },
        { prep: 150, label: '150 fuera de rango' },
        { prep: 18.5, label: 'decimal no entero' },
        { prep: '25' as any, label: 'string' },
        { prep: null as any, label: 'null' },
      ];

      for (const { prep, label } of invalidPayloads) {
        const res = await authRequest('patch', '/tenant/settings')
          .set('x-tenant-id', tenant.id)
          .set('x-user-role', 'ADMIN')
          .send({ estimatedPrepMinutes: prep });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }

      // Verificar que la BD permanece intacta en Postgres
      const inDb = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(inDb!.estimatedPrepMinutes).toBe(18);
    });

    it('PATCH con operatingMode inválido responde 400 VALIDATION_ERROR', async () => {
      const tenant = await createTestTenant('tenant-mode-invalid');

      const invalidModes = ['invalid', 'HYBRID', 'WAITER_ONLY', 'takeaway', 123, null, ''];

      for (const mode of invalidModes) {
        const res = await authRequest('patch', '/tenant/settings')
          .set('x-tenant-id', tenant.id)
          .set('x-user-role', 'ADMIN')
          .send({ operatingMode: mode });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }

      // Verificar que la BD no cambió
      const inDb = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(inDb!.operatingMode).toBe('hybrid');
    });

    it('PATCH con rol no autorizado responde 403 FORBIDDEN', async () => {
      const tenant = await createTestTenant('tenant-role-forbidden');

      const unauthorizedRoles = [
        'STAFF',
        'staff',
        'WAITER',
        'waiter',
        'CUSTOMER',
        'customer',
        'guest',
        '',
        'ANONYMOUS',
      ];

      for (const role of unauthorizedRoles) {
        const req = authRequest('patch', '/tenant/settings')
          .set('x-tenant-id', tenant.id)
          .send({ operatingMode: 'waiter_only' });

        if (role) {
          req.set('x-user-role', role);
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('FORBIDDEN');
      }

      // Verificar que la BD no cambió
      const inDb = await prisma.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(inDb!.operatingMode).toBe('hybrid');
    });

    it('PATCH sin campos a actualizar responde 400 VALIDATION_ERROR', async () => {
      const tenant = await createTestTenant('tenant-empty-patch');

      const res = await authRequest('patch', '/tenant/settings')
        .set('x-tenant-id', tenant.id)
        .set('x-user-role', 'ADMIN')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
