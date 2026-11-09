import { InMemoryTenantRepository, InMemoryUserRepository, InMemoryRefreshTokenRepository } from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createIdentityApp } from '../../src/app';

const TEST_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0';

describe('B. Identity — integración HTTP (Tests 11-15)', () => {
  let app: any;

  const tenantRepo = new InMemoryTenantRepository();
  const userRepo = new InMemoryUserRepository();
  const refreshTokenRepo = new InMemoryRefreshTokenRepository();

  beforeAll(() => {
    app = createIdentityApp({
      tenantRepo,
      userRepo,
      refreshTokenRepo
    });
  });

  test('11. POST /auth/register 201 -> tenant y user persistidos; el password en DB está hasheado (no contiene el claro)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Bistró Moderno',
        adminEmail: 'chef@bistro.com',
        adminPassword: 'supersecretpassword',
        adminDisplayName: 'Chef Pierre',
      });

    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  test('12. POST /auth/login 200 -> access JWT verificable con JWT_SECRET y claims sub/tenantId/role correctos', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'chef@bistro.com',
        password: 'supersecretpassword',
      });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();

    const decoded = jwt.verify(res.body.tokens.accessToken, TEST_SECRET) as any;
    expect(decoded.sub).toBe(res.body.user.id);
    expect(decoded.tenantId).toBe(res.body.user.tenantId);
    expect(decoded.role).toBe('ADMIN');
  });

  test('13. GET /identity/me con x-user-id/x-tenant-id -> 200 con el perfil del tenant correcto; sin cabeceras -> 401', async () => {
    const unauthRes = await request(app).get('/identity/me');
    expect(unauthRes.status).toBe(401);

    const authRes = await request(app)
      .get('/identity/me')
      .set('x-user-id', 'u-123')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN');

    expect(authRes.status).toBe(404);
  });

  test('14. POST /identity/users 201 -> con x-tenant-id y rol ADMIN en cabecera crea usuario ACTIVE con password inicial', async () => {
    const res = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'mesero1@bistro.com',
        displayName: 'Mesero 1',
        password: 'password123',
        role: 'STAFF',
      });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('STAFF');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.passwordHash).toBeUndefined();

    // Login del usuario creado devuelve 200 y tokens
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'mesero1@bistro.com',
        password: 'password123',
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.tokens.accessToken).toBeDefined();
  });

  test('15. POST /identity/users 403 -> sin rol ADMIN deniega la creación', async () => {
    const forbiddenRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'MANAGER')
      .send({
        email: 'mesero2@bistro.com',
        displayName: 'Mesero 2',
        password: 'password123',
        role: 'STAFF',
      });

    expect(forbiddenRes.status).toBe(403);

    const successRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'mesero2@bistro.com',
        displayName: 'Mesero 2',
        password: 'password123',
        role: 'STAFF',
      });
    expect(successRes.status).toBe(201);
    expect(successRes.body.status).toBe('ACTIVE');
  });

  test('16. POST /identity/users validaciones -> password < 8 (400), rol inválido (400), email repetido (409)', async () => {
    // Password corto -> 400
    const shortPassRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'shortpass@bistro.com',
        displayName: 'Short',
        password: 'short',
        role: 'STAFF',
      });
    expect(shortPassRes.status).toBe(400);
    expect(shortPassRes.body.error.code).toBe('VALIDATION_ERROR');

    // Rol inválido ADMIN -> 400
    const invalidRoleRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'fakeadmin@bistro.com',
        displayName: 'Fake Admin',
        password: 'password123',
        role: 'ADMIN',
      });
    expect(invalidRoleRes.status).toBe(400);
    expect(invalidRoleRes.body.error.code).toBe('VALIDATION_ERROR');

    // Email repetido -> 409
    const duplicateEmailRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'mesero1@bistro.com',
        displayName: 'Mesero Clon',
        password: 'password123',
        role: 'STAFF',
      });
    expect(duplicateEmailRes.status).toBe(409);
    expect(duplicateEmailRes.body.error.code).toBe('EMAIL_TAKEN');
  });

  describe('U2 endpoints: GET /identity/users, PATCH, disable, enable, reset-password', () => {
    test('17. GET /identity/users 200 para ADMIN del tenant; 403 para MANAGER/STAFF; sin passwordHash', async () => {
      const forbiddenRes = await request(app)
        .get('/identity/users')
        .set('x-tenant-id', 't-456')
        .set('x-user-role', 'MANAGER');
      expect(forbiddenRes.status).toBe(403);

      const res = await request(app)
        .get('/identity/users')
        .set('x-tenant-id', 't-456')
        .set('x-user-role', 'ADMIN');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      for (const u of res.body) {
        expect(u.passwordHash).toBeUndefined();
      }
    });

    test('18. PATCH /identity/users/:id actualiza rol/nombre; 403 auto-cambio rol de admin; 404 otro tenant', async () => {
      // Create admin user in repo
      await userRepo.save({
        id: 'admin-patch-id',
        tenantId: 't-patch',
        email: 'admin@t-patch.com',
        displayName: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: 'hashed_admin_pass',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user to update
      const createRes = await request(app)
        .post('/identity/users')
        .set('x-tenant-id', 't-patch')
        .set('x-user-role', 'ADMIN')
        .send({
          email: 'patch@bistro.com',
          displayName: 'Original Name',
          password: 'password123',
          role: 'STAFF',
        });
      const targetId = createRes.body.id;

      // Actualizar con éxito
      const patchRes = await request(app)
        .patch(`/identity/users/${targetId}`)
        .set('x-tenant-id', 't-patch')
        .set('x-user-id', 'admin-patch-id')
        .set('x-user-role', 'ADMIN')
        .send({
          displayName: 'Updated Name',
          role: 'MANAGER',
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.displayName).toBe('Updated Name');
      expect(patchRes.body.role).toBe('MANAGER');
      expect(patchRes.body.passwordHash).toBeUndefined();

      // Prohibir que admin cambie su propio rol
      const selfRoleRes = await request(app)
        .patch(`/identity/users/admin-patch-id`)
        .set('x-tenant-id', 't-patch')
        .set('x-user-id', 'admin-patch-id')
        .set('x-user-role', 'ADMIN')
        .send({ role: 'STAFF' });
      expect(selfRoleRes.status).toBe(403);

      // Aislamiento: 404 si es de otro tenant
      const otherTenantRes = await request(app)
        .patch(`/identity/users/${targetId}`)
        .set('x-tenant-id', 'other-tenant')
        .set('x-user-id', 'other-admin')
        .set('x-user-role', 'ADMIN')
        .send({ displayName: 'Hacked' });
      expect(otherTenantRes.status).toBe(404);
    });

    test('19. POST /identity/users/:id/disable y /enable; 403 auto-desactivar; login falla si DISABLED', async () => {
      // Create admin user in repo
      await userRepo.save({
        id: 'admin-disable-id',
        tenantId: 't-disable',
        email: 'admin@t-disable.com',
        displayName: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: 'hashed_admin_pass',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const createRes = await request(app)
        .post('/identity/users')
        .set('x-tenant-id', 't-disable')
        .set('x-user-role', 'ADMIN')
        .send({
          email: 'disableme@bistro.com',
          displayName: 'Will Disable',
          password: 'password123',
          role: 'STAFF',
        });
      const targetId = createRes.body.id;

      // Admin no puede auto-desactivarse
      const selfDisableRes = await request(app)
        .post('/identity/users/admin-disable-id/disable')
        .set('x-tenant-id', 't-disable')
        .set('x-user-id', 'admin-disable-id')
        .set('x-user-role', 'ADMIN');
      expect(selfDisableRes.status).toBe(403);

      // Desactivar usuario
      const disableRes = await request(app)
        .post(`/identity/users/${targetId}/disable`)
        .set('x-tenant-id', 't-disable')
        .set('x-user-id', 'admin-disable-id')
        .set('x-user-role', 'ADMIN');
      expect(disableRes.status).toBe(200);
      expect(disableRes.body.status).toBe('DISABLED');

      // Login del usuario DISABLED debe ser rechazado con 401 INVALID_CREDENTIALS
      const loginDisabledRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'disableme@bistro.com',
          password: 'password123',
        });
      expect(loginDisabledRes.status).toBe(401);
      expect(loginDisabledRes.body.error.code).toBe('INVALID_CREDENTIALS');

      // Reactivar usuario
      const enableRes = await request(app)
        .post(`/identity/users/${targetId}/enable`)
        .set('x-tenant-id', 't-disable')
        .set('x-user-id', 'admin-disable-id')
        .set('x-user-role', 'ADMIN');
      expect(enableRes.status).toBe(200);
      expect(enableRes.body.status).toBe('ACTIVE');

      // Ahora el login funciona de nuevo
      const loginEnabledRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'disableme@bistro.com',
          password: 'password123',
        });
      expect(loginEnabledRes.status).toBe(200);
    });

    test('20. POST /identity/users/:id/reset-password restablece contraseña', async () => {
      const createRes = await request(app)
        .post('/identity/users')
        .set('x-tenant-id', 't-reset')
        .set('x-user-role', 'ADMIN')
        .send({
          email: 'resetme@bistro.com',
          displayName: 'Reset Me',
          password: 'oldpassword123',
          role: 'STAFF',
        });
      const targetId = createRes.body.id;

      const resetRes = await request(app)
        .post(`/identity/users/${targetId}/reset-password`)
        .set('x-tenant-id', 't-reset')
        .set('x-user-role', 'ADMIN')
        .send({ password: 'brandnewpassword123' });
      expect(resetRes.status).toBe(200);

      // Login con la nueva contraseña funciona
      const loginNewRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'resetme@bistro.com',
          password: 'brandnewpassword123',
        });
      expect(loginNewRes.status).toBe(200);

      // Login con la vieja falla
      const loginOldRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'resetme@bistro.com',
          password: 'oldpassword123',
        });
      expect(loginOldRes.status).toBe(401);
    });

    test('21. POST /auth/change-password permite al usuario cambiar su propia contraseña', async () => {
      const createRes = await request(app)
        .post('/identity/users')
        .set('x-tenant-id', 't-change')
        .set('x-user-role', 'ADMIN')
        .send({
          email: 'changepass@bistro.com',
          displayName: 'Change Pass User',
          password: 'initialpassword123',
          role: 'STAFF',
        });
      const userId = createRes.body.id;

      // Contraseña actual errónea -> 401
      const wrongOldRes = await request(app)
        .post('/auth/change-password')
        .set('x-user-id', userId)
        .send({
          currentPassword: 'wrongcurrentpassword',
          newPassword: 'newsecurepassword123',
        });
      expect(wrongOldRes.status).toBe(401);

      // Contraseña actual correcta -> 200
      const okRes = await request(app)
        .post('/auth/change-password')
        .set('x-user-id', userId)
        .send({
          currentPassword: 'initialpassword123',
          newPassword: 'newsecurepassword123',
        });
      expect(okRes.status).toBe(200);

      // Login con la nueva contraseña
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'changepass@bistro.com',
          password: 'newsecurepassword123',
        });
      expect(loginRes.status).toBe(200);
    });

    test('22. POST /auth/refresh con token emitido por login/register rota secuencialmente con SHA-256 real y rechaza replay con 401', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'chef@bistro.com',
          password: 'supersecretpassword',
        });
      expect(loginRes.status).toBe(200);
      const rt1 = loginRes.body.tokens.refreshToken;
      expect(rt1).toBeDefined();

      // Primer refresh -> 200 OK y nuevo refreshToken
      const refresh1 = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: rt1 });
      expect(refresh1.status).toBe(200);
      expect(refresh1.body.accessToken).toBeDefined();
      expect(refresh1.body.refreshToken).toBeDefined();
      expect(refresh1.body.refreshToken).not.toBe(rt1);

      const decoded = jwt.verify(refresh1.body.accessToken, TEST_SECRET) as any;
      expect(decoded.sub).toBe(loginRes.body.user.id);
      expect(decoded.tenantId).toBe(loginRes.body.user.tenantId);
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.email).toBe('chef@bistro.com');

      // Replay del primer refreshToken -> 401 INVALID_CREDENTIALS
      const replayRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: rt1 });
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('INVALID_CREDENTIALS');

      // Rotación secuencial usando el segundo refreshToken -> 200 OK
      const refresh2 = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refresh1.body.refreshToken });
      expect(refresh2.status).toBe(200);
      expect(refresh2.body.accessToken).toBeDefined();
      expect(refresh2.body.refreshToken).toBeDefined();
    });
  });
});
