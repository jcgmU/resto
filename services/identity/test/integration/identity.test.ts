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

  test('14. POST /identity/users 201 -> con x-tenant-id y rol ADMIN en cabecera crea usuario', async () => {
    const res = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'mesero1@bistro.com',
        displayName: 'Mesero 1',
        role: 'STAFF',
      });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('STAFF');
    expect(res.body.status).toBe('INVITED');
  });

  test('15. POST /identity/users 403 -> sin rol ADMIN deniega la creación', async () => {
    const forbiddenRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'MANAGER')
      .send({
        email: 'mesero2@bistro.com',
        displayName: 'Mesero 2',
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
        role: 'STAFF',
      });
    expect(successRes.status).toBe(201);
  });

  test('16. GET /identity/users -> 200 para ADMIN y MANAGER, 403 para WAITER/STAFF, 401 sin cabecera', async () => {
    const unauth = await request(app).get('/identity/users');
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'WAITER');
    expect(forbidden.status).toBe(403);

    const okAdmin = await request(app)
      .get('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN');
    expect(okAdmin.status).toBe(200);
    expect(Array.isArray(okAdmin.body)).toBe(true);

    const okManager = await request(app)
      .get('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'MANAGER');
    expect(okManager.status).toBe(200);
  });

  test('17. POST /identity/users con password crea usuario activo con rol WAITER', async () => {
    const res = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'mesero.real@bistro.com',
        displayName: 'Carlos Mesero Real',
        role: 'WAITER',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('WAITER');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.displayName).toBe('Carlos Mesero Real');
  });

  test('18. POST /identity/users con rol MONITOR valida monitorKind kitchen/bar', async () => {
    const errRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'monitor.nokind@bistro.com',
        displayName: 'Monitor Sin Tipo',
        role: 'MONITOR',
        password: 'pass',
      });
    expect(errRes.status).toBe(400);

    const okRes = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'monitor.bar@bistro.com',
        displayName: 'Monitor Bar',
        role: 'MONITOR',
        monitorKind: 'bar',
        password: 'pass',
      });
    expect(okRes.status).toBe(201);
    expect(okRes.body.role).toBe('MONITOR');
    expect(okRes.body.monitorKind).toBe('bar');
  });

  test('19. POST /identity/users con rol CASHIER crea usuario con rol CASHIER', async () => {
    const res = await request(app)
      .post('/identity/users')
      .set('x-tenant-id', 't-456')
      .set('x-user-role', 'ADMIN')
      .send({
        email: 'caja.real@bistro.com',
        displayName: 'Cajero Principal',
        role: 'CASHIER',
        password: 'password123',
      });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('CASHIER');
    expect(res.body.status).toBe('ACTIVE');
  });
});
