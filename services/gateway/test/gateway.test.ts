import request from 'supertest';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';

const TEST_SECRET = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = TEST_SECRET;
process.env.IDENTITY_SERVICE_URL = 'http://localhost:4001';
process.env.CATALOG_SERVICE_URL = 'http://localhost:4002';
process.env.SESSION_SERVICE_URL = 'http://localhost:4003';
process.env.ORDERING_SERVICE_URL = 'http://localhost:4004';

describe('B. @services/gateway — API Gateway (Tests 15-27)', () => {
  let app: any;

  beforeEach(() => {
    nock.cleanAll();
    app = createApp();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Health y enrutado (Tests 15-19)', () => {
    test('15. GET /health -> 200 con { status: "live" } (alias a /health/live)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'live' });
    });

    test('16. POST /v1/auth/login -> proxy a identity:4001/auth/login, conservando body y propagando status/body del upstream', async () => {
      const upstream = nock('http://localhost:4001')
        .post('/auth/login', { email: 'admin@resto.com', password: 'password123' })
        .reply(200, { token: 'jwt-token-xyz' });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'admin@resto.com', password: 'password123' });

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ token: 'jwt-token-xyz' });
    });

    test('17. POST /v1/graphql -> proxy a catalog:4002/graphql', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'admin' }, TEST_SECRET);
      const upstream = nock('http://localhost:4002')
        .post('/graphql', { query: '{ menu { id } }' })
        .reply(200, { data: { menu: [] } });

      const res = await request(app)
        .post('/v1/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: '{ menu { id } }' });

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { menu: [] } });
    });

    test('18. GET /v1/sessions/abc -> proxy a session:4003/sessions/abc', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
      const upstream = nock('http://localhost:4003')
        .get('/sessions/abc')
        .reply(200, { id: 'abc', tableId: '10' });

      const res = await request(app)
        .get('/v1/sessions/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'abc', tableId: '10' });
    });

    test('19. POST /v1/orders -> proxy a ordering:4004/orders', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
      const upstream = nock('http://localhost:4004')
        .post('/orders', { items: ['item-1'] })
        .reply(201, { orderId: 'ord-123' });

      const res = await request(app)
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: ['item-1'] });

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ orderId: 'ord-123' });
    });
  });

  describe('Auth (Tests 20-24)', () => {
    test('20. Ruta protegida sin cabecera Authorization -> 401 { error.code: "UNAUTHORIZED" }', async () => {
      const res = await request(app).get('/v1/sessions/123');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('21. Ruta protegida con JWT inválido o expirado -> 401', async () => {
      const invalidToken = 'not.a.valid.jwt';
      const res = await request(app)
        .get('/v1/sessions/123')
        .set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('22. Ruta protegida con JWT válido -> el upstream recibe x-user-id y x-tenant-id correctos', async () => {
      const token = jwt.sign({ userId: 'user-77', tenantId: 'tenant-99', role: 'customer' }, TEST_SECRET);
      const upstream = nock('http://localhost:4003', {
        reqheaders: {
          'x-user-id': 'user-77',
          'x-tenant-id': 'tenant-99',
        },
      })
        .get('/sessions/123')
        .reply(200, { ok: true });

      const res = await request(app)
        .get('/v1/sessions/123')
        .set('Authorization', `Bearer ${token}`);

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
    });

    test('23. PATCH /v1/orders/:id/status con JWT de rol customer -> 403', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
      const res = await request(app)
        .patch('/v1/orders/ord-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('24. POST /v1/auth/login no exige token (ruta pública)', async () => {
      nock('http://localhost:4001')
        .post('/auth/login')
        .reply(200, { token: 'jwt' });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'test@resto.com', password: 'secret' });

      expect(res.status).not.toBe(401);
      expect(res.status).toBe(200);
    });
  });

  describe('Errores (Tests 25-26)', () => {
    test('25. Ruta desconocida /v1/nope -> 404 { error.code: "NOT_FOUND" }', async () => {
      const res = await request(app).get('/v1/nope');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('26. Upstream caído -> 502 { error.code: "UPSTREAM_UNAVAILABLE" }', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
      nock('http://localhost:4003')
        .get('/sessions/crash')
        .replyWithError('Connection refused');

      const res = await request(app)
        .get('/v1/sessions/crash')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(502);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    });
  });

  describe('WebSocket (Test 27)', () => {
    beforeEach(() => {
      (app as any)._attachSockets = true;
    });

    afterEach(() => {
      (app as any)._attachSockets = false;
    });

    test('27. socket.io-client conecta al namespace /orders a través del gateway contra un stub de ordering', (done) => {
      // Stub server for ordering WebSocket upstream
      const orderingHttpServer = http.createServer();
      const orderingIo = new SocketIOServer(orderingHttpServer);
      const ordersNamespace = orderingIo.of('/orders');

      ordersNamespace.on('connection', (socket) => {
        socket.emit('ready', { message: 'ordering-connected' });
      });

      orderingHttpServer.listen(0, () => {
        const orderingPort = (orderingHttpServer.address() as any).port;
        process.env.ORDERING_WS_PORT = String(orderingPort);

        // Gateway HTTP server with socket proxying
        const gatewayServer = http.createServer(app);
        gatewayServer.listen(0, () => {
          const gatewayPort = (gatewayServer.address() as any).port;
          const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);

          const client: ClientSocket = ioc(`http://localhost:${gatewayPort}/orders`, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false,
            timeout: 1000,
          });

          client.on('connect_error', (err) => {
            client.close();
            gatewayServer.close();
            orderingHttpServer.close();
            // In RED phase, gateway has no socket.io handler so connect will fail/timeout
            expect(err).toBeDefined();
            // We force failure here for Red phase
            done(new Error(`WebSocket connection failed as expected in Red phase: ${err.message}`));
          });

          client.on('ready', (data) => {
            expect(data.message).toBe('ordering-connected');
            client.close();
            gatewayServer.close();
            orderingHttpServer.close();
            done();
          });
        });
      });
    }, 4000);

    test('28. socketProxy reenvía auth token del cliente a la conexión upstream', (done) => {
      const orderingHttpServer = http.createServer();
      const orderingIo = new SocketIOServer(orderingHttpServer);
      const ordersNamespace = orderingIo.of('/orders');

      let receivedAuthToken: string | undefined;
      ordersNamespace.use((socket, next) => {
        receivedAuthToken = socket.handshake.auth?.token;
        next();
      });

      ordersNamespace.on('connection', (socket) => {
        socket.emit('ready', { message: 'ordering-connected' });
      });

      orderingHttpServer.listen(0, () => {
        const orderingPort = (orderingHttpServer.address() as any).port;
        process.env.ORDERING_WS_PORT = String(orderingPort);

        const gatewayServer = http.createServer(app);
        gatewayServer.listen(0, () => {
          const gatewayPort = (gatewayServer.address() as any).port;
          const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'ADMIN' }, TEST_SECRET);

          const client: ClientSocket = ioc(`http://localhost:${gatewayPort}/orders`, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false,
            timeout: 1000,
          });

          client.on('ready', () => {
            expect(receivedAuthToken).toBe(token);
            client.close();
            gatewayServer.close();
            orderingHttpServer.close();
            done();
          });

          client.on('connect_error', (err) => {
            client.close();
            gatewayServer.close();
            orderingHttpServer.close();
            done(err);
          });
        });
      });
    }, 4000);
  });

  describe('CORS (D5)', () => {
    test('29. Acepta orígenes con espacios iniciales/finales y responde con Access-Control-Allow-Origin', async () => {
      const origEnv = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = 'http://localhost:3000, http://localhost:3001 ';
      let isolatedApp: any;
      jest.isolateModules(() => {
        const { createApp: makeApp } = require('../src/app');
        isolatedApp = makeApp();
      });
      process.env.CORS_ORIGINS = origEnv;

      const res = await request(isolatedApp)
        .get('/health')
        .set('Origin', 'http://localhost:3001');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });
  });

  describe('Internal Auth Token (R08)', () => {
    test('30. Gateway inyecta x-internal-token al hacer proxy a upstream', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer' }, TEST_SECRET);
      const upstream = nock('http://localhost:4003', {
        reqheaders: {
          'x-internal-token': 'resto-internal-shared-secret-dev-2026',
        },
      })
        .get('/sessions/internal-test')
        .reply(200, { ok: true });

      const res = await request(app)
        .get('/v1/sessions/internal-test')
        .set('Authorization', `Bearer ${token}`);

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
    });
  });

  describe('FASE B Routes & Role Wiring (V20)', () => {
    function makeToken(role: string, extra?: Record<string, any>) {
      return jwt.sign(
        {
          userId: `usr-${role.toLowerCase()}`,
          tenantId: 'tenant-demo',
          role,
          ...extra,
        },
        TEST_SECRET
      );
    }

    const INTERNAL_SECRET = 'resto-internal-shared-secret-dev-2026';

    // 1. Tenant Settings
    describe('Tenant Settings', () => {
      test('GET /v1/tenant/settings con staff (ADMIN) -> proxy a identity con internal token y headers', async () => {
        const token = makeToken('ADMIN');
        const upstream = nock('http://localhost:4001', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'ADMIN',
            'x-tenant-id': 'tenant-demo',
          },
        })
          .get('/tenant/settings')
          .reply(200, { operatingMode: 'hybrid', estimatedPrepMinutes: 18 });

        const res = await request(app)
          .get('/v1/tenant/settings')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ operatingMode: 'hybrid', estimatedPrepMinutes: 18 });
      });

      test('GET /v1/tenant/settings con staff (WAITER) -> permitido', async () => {
        const token = makeToken('WAITER');
        const upstream = nock('http://localhost:4001')
          .get('/tenant/settings')
          .reply(200, { operatingMode: 'hybrid', estimatedPrepMinutes: 18 });

        const res = await request(app)
          .get('/v1/tenant/settings')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('GET /v1/tenant/settings con guest -> permitido, proxy a identity', async () => {
        const token = makeToken('guest', { sessionId: 'sess-123' });
        const upstream = nock('http://localhost:4001', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'guest',
          },
        })
          .get('/tenant/settings')
          .reply(200, { operatingMode: 'hybrid' });

        const res = await request(app)
          .get('/v1/tenant/settings')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ operatingMode: 'hybrid' });
      });

      test('GET /v1/tenant/settings sin Authorization -> 401 UNAUTHORIZED', async () => {
        const res = await request(app).get('/v1/tenant/settings');
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      test('PATCH /v1/tenant/settings con ADMIN o MANAGER -> proxy a identity:4001/tenant/settings', async () => {
        for (const role of ['ADMIN', 'MANAGER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4001', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .patch('/tenant/settings', { operatingMode: 'waiter_only' })
            .reply(200, { operatingMode: 'waiter_only', estimatedPrepMinutes: 18 });

          const res = await request(app)
            .patch('/v1/tenant/settings')
            .set('Authorization', `Bearer ${token}`)
            .send({ operatingMode: 'waiter_only' });

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
        }
      });

      test('PATCH /v1/tenant/settings con rol no autorizado (STAFF, WAITER, guest) -> 403 FORBIDDEN', async () => {
        for (const role of ['STAFF', 'WAITER', 'guest']) {
          const token = makeToken(role);
          const res = await request(app)
            .patch('/v1/tenant/settings')
            .set('Authorization', `Bearer ${token}`)
            .send({ operatingMode: 'waiter_only' });

          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      });
    });

    // 2. Zonas
    describe('Zonas', () => {
      test('GET /v1/zones permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session:4003/zones', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .get('/zones')
            .reply(200, [{ id: 'z1', name: 'Terraza' }]);

          const res = await request(app)
            .get('/v1/zones')
            .set('Authorization', `Bearer ${token}`);

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          expect(res.body).toEqual([{ id: 'z1', name: 'Terraza' }]);
        }
      });

      test('GET /v1/zones denegado para guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const res = await request(app)
          .get('/v1/zones')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      test('POST /v1/zones permitido para ADMIN, MANAGER -> proxy a session:4003/zones', async () => {
        for (const role of ['ADMIN', 'MANAGER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .post('/zones', { name: 'VIP', sortOrder: 3 })
            .reply(201, { id: 'z3', name: 'VIP', sortOrder: 3 });

          const res = await request(app)
            .post('/v1/zones')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'VIP', sortOrder: 3 });

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(201);
        }
      });

      test('POST /v1/zones denegado para STAFF, WAITER, guest -> 403 FORBIDDEN', async () => {
        for (const role of ['STAFF', 'WAITER', 'guest']) {
          const token = makeToken(role);
          const res = await request(app)
            .post('/v1/zones')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'VIP' });

          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      });

      test('PATCH /v1/zones/:id permitido para ADMIN, MANAGER -> proxy a session:4003/zones/:id', async () => {
        const token = makeToken('ADMIN');
        const upstream = nock('http://localhost:4003')
          .patch('/zones/z1', { name: 'Terraza Nueva' })
          .reply(200, { id: 'z1', name: 'Terraza Nueva' });

        const res = await request(app)
          .patch('/v1/zones/z1')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Terraza Nueva' });

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('PATCH /v1/zones/:id denegado para WAITER -> 403 FORBIDDEN', async () => {
        const token = makeToken('WAITER');
        const res = await request(app)
          .patch('/v1/zones/z1')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Terraza Nueva' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      test('DELETE /v1/zones/:id permitido para ADMIN, MANAGER -> proxy a session:4003/zones/:id', async () => {
        const token = makeToken('MANAGER');
        const upstream = nock('http://localhost:4003')
          .delete('/zones/z1')
          .reply(200, { success: true });

        const res = await request(app)
          .delete('/v1/zones/z1')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('DELETE /v1/zones/:id denegado para STAFF y guest -> 403 FORBIDDEN', async () => {
        for (const role of ['STAFF', 'guest']) {
          const token = makeToken(role);
          const res = await request(app)
            .delete('/v1/zones/z1')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      });
    });

    // 3. Reservas
    describe('Reservas', () => {
      test('GET /v1/reservations permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session:4003/reservations', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003')
            .get('/reservations')
            .reply(200, [{ id: 'r1', customerName: 'Carlos' }]);

          const res = await request(app)
            .get('/v1/reservations')
            .set('Authorization', `Bearer ${token}`);

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
        }
      });

      test('GET /v1/reservations denegado para guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const res = await request(app)
          .get('/v1/reservations')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      test('POST /v1/reservations permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session:4003/reservations', async () => {
        for (const role of ['STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003')
            .post('/reservations', { customerName: 'Laura', partySize: 4 })
            .reply(201, { id: 'r2', customerName: 'Laura', partySize: 4 });

          const res = await request(app)
            .post('/v1/reservations')
            .set('Authorization', `Bearer ${token}`)
            .send({ customerName: 'Laura', partySize: 4 });

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(201);
        }
      });

      test('PATCH /v1/reservations/:id/cancel permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session', async () => {
        const token = makeToken('WAITER');
        const upstream = nock('http://localhost:4003')
          .patch('/reservations/r1/cancel')
          .reply(200, { id: 'r1', status: 'cancelled' });

        const res = await request(app)
          .patch('/v1/reservations/r1/cancel')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('POST /v1/reservations/:id/seat permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session', async () => {
        const token = makeToken('STAFF');
        const upstream = nock('http://localhost:4003')
          .post('/reservations/r1/seat')
          .reply(200, { reservation: { id: 'r1', status: 'seated' }, session: { id: 'sess-1' } });

        const res = await request(app)
          .post('/v1/reservations/r1/seat')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('Rutas de reservas denegadas para guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const postRes = await request(app)
          .post('/v1/reservations')
          .set('Authorization', `Bearer ${token}`)
          .send({ customerName: 'Hacker' });
        expect(postRes.status).toBe(403);

        const cancelRes = await request(app)
          .patch('/v1/reservations/r1/cancel')
          .set('Authorization', `Bearer ${token}`);
        expect(cancelRes.status).toBe(403);

        const seatRes = await request(app)
          .post('/v1/reservations/r1/seat')
          .set('Authorization', `Bearer ${token}`);
        expect(seatRes.status).toBe(403);
      });
    });

    // 4. Uploads y Contenido Estático
    describe('Uploads y Contenido Estático', () => {
      test('POST /v1/uploads permitido para ADMIN y MANAGER -> proxy a catalog:4002/uploads', async () => {
        for (const role of ['ADMIN', 'MANAGER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4002', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .post('/uploads')
            .reply(201, { url: '/uploads/img-123.webp' });

          const res = await request(app)
            .post('/v1/uploads')
            .set('Authorization', `Bearer ${token}`);

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(201);
          expect(res.body).toEqual({ url: '/uploads/img-123.webp' });
        }
      });

      test('POST /v1/uploads denegado para STAFF, WAITER y guest -> 403 FORBIDDEN', async () => {
        for (const role of ['STAFF', 'WAITER', 'guest']) {
          const token = makeToken(role);
          const res = await request(app)
            .post('/v1/uploads')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      });

      test('GET /uploads/:file público (sin token) -> proxy a catalog:4002/uploads/:file con x-internal-token', async () => {
        const upstream = nock('http://localhost:4002', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
          },
        })
          .get('/uploads/sample.png')
          .reply(200, 'fake-image-bytes', { 'content-type': 'image/png' });

        const res = await request(app).get('/uploads/sample.png');

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('GET /v1/uploads/:file público (sin token) -> proxy a catalog:4002/uploads/:file', async () => {
        const upstream = nock('http://localhost:4002', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
          },
        })
          .get('/uploads/sample2.jpg')
          .reply(200, 'fake-image-bytes', { 'content-type': 'image/jpeg' });

        const res = await request(app).get('/v1/uploads/sample2.jpg');

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });
    });

    // 5. Órdenes: Historial y Demora
    describe('Órdenes: Historial y Demora', () => {
      test('GET /v1/orders/:id/history con guest -> proxy a ordering:4004/orders/:id/history', async () => {
        const token = makeToken('guest', { sessionId: 'sess-777' });
        const upstream = nock('http://localhost:4004', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'guest',
            'x-session-id': 'sess-777',
          },
        })
          .get('/orders/ord-99/history')
          .reply(200, [
            { status: 'CONFIRMED', timestamp: '2026-10-14T10:00:00Z' },
            { status: 'IN_KITCHEN', timestamp: '2026-10-14T10:05:00Z' },
          ]);

        const res = await request(app)
          .get('/v1/orders/ord-99/history')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
      });

      test('GET /v1/orders/:id/history con staff (WAITER) -> proxy a ordering:4004/orders/:id/history', async () => {
        const token = makeToken('WAITER');
        const upstream = nock('http://localhost:4004', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'WAITER',
          },
        })
          .get('/orders/ord-99/history')
          .reply(200, []);

        const res = await request(app)
          .get('/v1/orders/ord-99/history')
          .set('Authorization', `Bearer ${token}`);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      });

      test('GET /v1/orders/:id/history sin Authorization -> 401 UNAUTHORIZED', async () => {
        const res = await request(app).get('/v1/orders/ord-99/history');
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      test('PATCH /v1/orders/:id/delay con ADMIN, MANAGER, STAFF, WAITER -> proxy a ordering:4004/orders/:id/delay', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4004', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .patch('/orders/ord-99/delay', { delayMinutes: 15 })
            .reply(200, { id: 'ord-99', delayMinutes: 15 });

          const res = await request(app)
            .patch('/v1/orders/ord-99/delay')
            .set('Authorization', `Bearer ${token}`)
            .send({ delayMinutes: 15 });

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          expect(res.body.delayMinutes).toBe(15);
        }
      });

      test('PATCH /v1/orders/:id/delay con guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const res = await request(app)
          .patch('/v1/orders/ord-99/delay')
          .set('Authorization', `Bearer ${token}`)
          .send({ delayMinutes: 15 });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    });

    // 6. Sesiones: staff-open, bill-request, bill-reopen
    describe('Sesiones FASE B', () => {
      test('POST /v1/sessions/staff-open permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session:4003/sessions/staff-open', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .post('/sessions/staff-open', { tableId: 't-1' })
            .reply(200, { sessionId: 'sess-staff-1', tableId: 't-1', status: 'active' });

          const res = await request(app)
            .post('/v1/sessions/staff-open')
            .set('Authorization', `Bearer ${token}`)
            .send({ tableId: 't-1' });

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          expect(res.body.sessionId).toBe('sess-staff-1');
        }
      });

      test('POST /v1/sessions/staff-open denegado para guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const res = await request(app)
          .post('/v1/sessions/staff-open')
          .set('Authorization', `Bearer ${token}`)
          .send({ tableId: 't-1' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      test('POST /v1/sessions/:id/bill-request permitido para ALL (guest y staff) -> proxy a session', async () => {
        // Guest
        const guestToken = makeToken('guest', { sessionId: 'sess-1' });
        const guestUpstream = nock('http://localhost:4003', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'guest',
          },
        })
          .post('/sessions/sess-1/bill-request')
          .reply(200, { sessionId: 'sess-1', status: 'billRequested' });

        const guestRes = await request(app)
          .post('/v1/sessions/sess-1/bill-request')
          .set('Authorization', `Bearer ${guestToken}`);

        expect(guestUpstream.isDone()).toBe(true);
        expect(guestRes.status).toBe(200);
        expect(guestRes.body.status).toBe('billRequested');

        // Staff (WAITER)
        const staffToken = makeToken('WAITER');
        const staffUpstream = nock('http://localhost:4003', {
          reqheaders: {
            'x-internal-token': INTERNAL_SECRET,
            'x-user-role': 'WAITER',
          },
        })
          .post('/sessions/sess-1/bill-request')
          .reply(200, { sessionId: 'sess-1', status: 'billRequested' });

        const staffRes = await request(app)
          .post('/v1/sessions/sess-1/bill-request')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(staffUpstream.isDone()).toBe(true);
        expect(staffRes.status).toBe(200);
      });

      test('POST /v1/sessions/:id/bill-reopen permitido para ADMIN, MANAGER, STAFF, WAITER -> proxy a session', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'WAITER']) {
          const token = makeToken(role);
          const upstream = nock('http://localhost:4003', {
            reqheaders: {
              'x-internal-token': INTERNAL_SECRET,
              'x-user-role': role,
            },
          })
            .post('/sessions/sess-1/bill-reopen')
            .reply(200, { sessionId: 'sess-1', status: 'active' });

          const res = await request(app)
            .post('/v1/sessions/sess-1/bill-reopen')
            .set('Authorization', `Bearer ${token}`);

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          expect(res.body.status).toBe('active');
        }
      });

      test('POST /v1/sessions/:id/bill-reopen denegado para guest -> 403 FORBIDDEN', async () => {
        const token = makeToken('guest');
        const res = await request(app)
          .post('/v1/sessions/sess-1/bill-reopen')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    });
  });
});
