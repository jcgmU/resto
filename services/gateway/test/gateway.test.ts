import request from 'supertest';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { routeTable } from '../src/routes/routeTable';

const TEST_SECRET = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = TEST_SECRET;
process.env.INTERNAL_SHARED_SECRET = 'resto-internal-shared-secret-dev-2026';
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

    test('16b. POST /v1/auth/login con body vacío {} -> proxy reenvía body {} sin colgar', async () => {
      const upstream = nock('http://localhost:4001')
        .post('/auth/login', {})
        .reply(400, { error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({});

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }, 5000);

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

    test('24b. U5/D1: GET /v1/identity/users sin token -> 401; con token STAFF -> 403; con token MANAGER y ADMIN -> 200 proxy a identity', async () => {
      // Sin token -> 401
      const unauthRes = await request(app).get('/v1/identity/users');
      expect(unauthRes.status).toBe(401);

      // Con token STAFF -> 403 (D1: lectura solo admin y manager)
      const staffToken = jwt.sign({ userId: 'u-stf', tenantId: 't-1', role: 'waiter' }, TEST_SECRET);
      const forbiddenRes = await request(app)
        .get('/v1/identity/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

      // Con token MANAGER -> 200 proxy (D1)
      const managerToken = jwt.sign({ userId: 'u-mgr', tenantId: 't-1', role: 'manager' }, TEST_SECRET);
      const mgrUpstream = nock('http://localhost:4001', {
        reqheaders: {
          'x-user-id': 'u-mgr',
          'x-tenant-id': 't-1',
          'x-user-role': 'manager',
        },
      })
        .get('/identity/users')
        .reply(200, [{ id: 'u1', email: 'staff@resto.com' }]);

      const mgrRes = await request(app)
        .get('/v1/identity/users')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(mgrUpstream.isDone()).toBe(true);
      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body).toEqual([{ id: 'u1', email: 'staff@resto.com' }]);

      // Con token ADMIN -> 200 proxy
      const adminToken = jwt.sign({ userId: 'u-adm', tenantId: 't-1', role: 'admin' }, TEST_SECRET);
      const upstream = nock('http://localhost:4001', {
        reqheaders: {
          'x-user-id': 'u-adm',
          'x-tenant-id': 't-1',
          'x-user-role': 'admin',
        },
      })
        .get('/identity/users')
        .reply(200, [{ id: 'u1', email: 'staff@resto.com' }]);

      const okRes = await request(app)
        .get('/v1/identity/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(upstream.isDone()).toBe(true);
      expect(okRes.status).toBe(200);
      expect(okRes.body).toEqual([{ id: 'u1', email: 'staff@resto.com' }]);
    });

    test('24c. U5: cabeceras x-user-role o x-tenant-id inyectadas por el cliente son sobreescritas o eliminadas por el gateway', async () => {
      const staffToken = jwt.sign({ userId: 'u-staff', tenantId: 'real-tenant', role: 'waiter' }, TEST_SECRET);
      const upstream = nock('http://localhost:4003', {
        reqheaders: {
          'x-user-id': 'u-staff',
          'x-tenant-id': 'real-tenant',
          'x-user-role': 'waiter',
        },
      })
        .get('/sessions/123')
        .reply(200, { ok: true });

      const res = await request(app)
        .get('/v1/sessions/123')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-user-role', 'admin') // Spoofed header
        .set('x-tenant-id', 'spoofed-tenant'); // Spoofed header

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
    });

    test('24e. U2: guest JWT sin rol con spoof x-role: ADMIN y x-user-role: ADMIN tiene todas las cabeceras de rol eliminadas/fijadas a GUEST y upstream no recibe x-role', async () => {
      // Guest token: issued with sessionId, tableId, tenantId, but without staff role
      const guestToken = jwt.sign({ sessionId: 'session-guest-99', tableId: 'table-5', tenantId: 'tenant-real' }, TEST_SECRET);
      let capturedHeaders: any = null;
      const upstream = nock('http://localhost:4002')
        .post('/graphql')
        .reply(function (this: any, _uri, _requestBody) {
          capturedHeaders = this.req.headers;
          return [200, { data: { categories: [] } }];
        });

      const res = await request(app)
        .post('/v1/graphql')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('x-role', 'ADMIN') // Spoofed header
        .set('x-user-role', 'ADMIN') // Spoofed header
        .set('x-user-id', 'spoofed-user-id') // Spoofed header
        .set('x-tenant-id', 'spoofed-tenant-id') // Spoofed header
        .send({ query: '{ categories { id } }' });

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
      expect(capturedHeaders).toBeDefined();
      expect(capturedHeaders['x-role']).toBeUndefined();
      expect(capturedHeaders['x-user-role']).toBe('GUEST');
      expect(capturedHeaders['x-session-id']).toBe('session-guest-99');
      expect(capturedHeaders['x-tenant-id']).toBe('tenant-real');
      expect(capturedHeaders['x-user-id']).toBeUndefined();
    });

    test('24d. U5: POST /v1/auth/change-password exige token y forwardea x-user-id a identity', async () => {
      // Sin token -> 401
      const unauthRes = await request(app).post('/v1/auth/change-password').send({});
      expect(unauthRes.status).toBe(401);

      // Con token -> forwardea a identity
      const token = jwt.sign({ userId: 'u-pass', tenantId: 't-1', role: 'waiter' }, TEST_SECRET);
      const upstream = nock('http://localhost:4001', {
        reqheaders: {
          'x-user-id': 'u-pass',
        },
      })
        .post('/auth/change-password', { currentPassword: 'old', newPassword: 'newpassword123' })
        .reply(200, { message: 'ok' });

      const res = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old', newPassword: 'newpassword123' });

      expect(upstream.isDone()).toBe(true);
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
    let activeOrderingIo: SocketIOServer | null = null;
    let activeGatewayIo: any = null;

    beforeEach(() => {
      (app as any)._attachSockets = true;
    });

    afterEach(() => {
      (app as any)._attachSockets = false;
      if (activeOrderingIo) {
        try {
          activeOrderingIo.close();
        } catch {}
        activeOrderingIo = null;
      }
      if (activeGatewayIo) {
        try {
          activeGatewayIo.close();
        } catch {}
        activeGatewayIo = null;
      }
    });

    afterAll(() => {
      if (activeOrderingIo) {
        try {
          activeOrderingIo.close();
        } catch {}
        activeOrderingIo = null;
      }
      if (activeGatewayIo) {
        try {
          activeGatewayIo.close();
        } catch {}
        activeGatewayIo = null;
      }
    });

    test('27. socket.io-client conecta al namespace /orders a través del gateway contra un stub de ordering', (done) => {
      // Stub server for ordering WebSocket upstream
      const orderingHttpServer = http.createServer();
      const orderingIo = new SocketIOServer(orderingHttpServer);
      activeOrderingIo = orderingIo;
      const ordersNamespace = orderingIo.of('/orders');

      ordersNamespace.on('connection', (socket) => {
        socket.emit('ready', { message: 'ordering-connected' });
      });

      orderingHttpServer.listen(0, () => {
        const orderingPort = (orderingHttpServer.address() as any).port;
        process.env.ORDERING_WS_PORT = String(orderingPort);

        // Gateway HTTP server with socket proxying
        const gatewayServer = http.createServer(app);
        activeGatewayIo = (gatewayServer as any)._socketGatewayIo;
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
            client.disconnect();
            client.close();
            if (activeGatewayIo) {
              try { activeGatewayIo.close(); } catch {}
              activeGatewayIo = null;
            }
            orderingIo.close();
            activeOrderingIo = null;
            gatewayServer.close();
            orderingHttpServer.close();
            // In RED phase, gateway has no socket.io handler so connect will fail/timeout
            expect(err).toBeDefined();
            // We force failure here for Red phase
            done(new Error(`WebSocket connection failed as expected in Red phase: ${err.message}`));
          });

          client.on('ready', (data) => {
            expect(data.message).toBe('ordering-connected');
            client.disconnect();
            client.close();
            if (activeGatewayIo) {
              try { activeGatewayIo.close(); } catch {}
              activeGatewayIo = null;
            }
            orderingIo.close();
            activeOrderingIo = null;
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
      activeOrderingIo = orderingIo;
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
        activeGatewayIo = (gatewayServer as any)._socketGatewayIo;
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
            client.disconnect();
            client.close();
            if (activeGatewayIo) {
              try { activeGatewayIo.close(); } catch {}
              activeGatewayIo = null;
            }
            orderingIo.close();
            activeOrderingIo = null;
            gatewayServer.close();
            orderingHttpServer.close();
            done();
          });

          client.on('connect_error', (err) => {
            client.disconnect();
            client.close();
            if (activeGatewayIo) {
              try { activeGatewayIo.close(); } catch {}
              activeGatewayIo = null;
            }
            orderingIo.close();
            activeOrderingIo = null;
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
            'x-user-role': 'GUEST',
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
        for (const role of ['WAITER', 'WAITER', 'guest']) {
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
        for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
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
        for (const role of ['WAITER', 'WAITER', 'guest']) {
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
        for (const role of ['WAITER', 'guest']) {
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
        for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
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
        for (const role of ['WAITER', 'WAITER']) {
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
        const token = makeToken('WAITER');
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
        for (const role of ['WAITER', 'WAITER', 'guest']) {
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
            'x-user-role': 'GUEST',
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

      describe('x-session-id explícito (terminal de mesero)', () => {
        const captureCartHeaders = () => {
          const captured: { headers?: Record<string, any> } = {};
          const upstream = nock('http://localhost:4004')
            .post('/cart/confirm')
            .reply(function (this: any) {
              captured.headers = this.req.headers;
              return [200, {}];
            });
          return { captured, upstream };
        };

        test('staff (ADMIN, MANAGER, STAFF, WAITER) conserva el x-session-id que envía el cliente', async () => {
          for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
            const { captured, upstream } = captureCartHeaders();
            const res = await request(app)
              .post('/v1/cart/confirm')
              .set('Authorization', `Bearer ${makeToken(role)}`)
              .set('x-session-id', 'sess-mesa-1')
              .send({ notes: 'x' });

            expect(res.status).toBe(200);
            expect(upstream.isDone()).toBe(true);
            expect(captured.headers?.['x-session-id']).toBe('sess-mesa-1');
          }
        });

        test('guest con sessionId en el token ignora un x-session-id distinto del cliente', async () => {
          const { captured } = captureCartHeaders();
          await request(app)
            .post('/v1/cart/confirm')
            .set('Authorization', `Bearer ${makeToken('guest', { sessionId: 'sess-propia' })}`)
            .set('x-session-id', 'sess-ajena')
            .send({ notes: 'x' });

          expect(captured.headers?.['x-session-id']).toBe('sess-propia');
        });

        test('roles no staff (CASHIER, MONITOR) no pueden inyectar x-session-id', async () => {
          for (const role of ['CASHIER', 'MONITOR']) {
            const { captured } = captureCartHeaders();
            await request(app)
              .post('/v1/cart/confirm')
              .set('Authorization', `Bearer ${makeToken(role)}`)
              .set('x-session-id', 'sess-ajena')
              .send({ notes: 'x' });

            expect(captured.headers?.['x-session-id']).toBeUndefined();
            nock.cleanAll();
          }
        });
      });

      test('GET /v1/orders/:id/history sin Authorization -> 401 UNAUTHORIZED', async () => {
        const res = await request(app).get('/v1/orders/ord-99/history');
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      test('PATCH /v1/orders/:id/delay con ADMIN, MANAGER, STAFF, WAITER -> proxy a ordering:4004/orders/:id/delay', async () => {
        for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
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
        for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
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
            'x-user-role': 'GUEST',
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
        for (const role of ['ADMIN', 'MANAGER', 'WAITER', 'WAITER']) {
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

  describe('X1: Reenvío de cuerpos HTTP contra upstream Express real (Tests 29-32)', () => {
    let upstreamServer: http.Server;
    let originalOrderingUrl: string;
    let lastReceivedHeaders: http.IncomingHttpHeaders | undefined;
    let lastReceivedBody: any;
    let lastRawBytesLength: number;

    beforeEach((done) => {
      originalOrderingUrl = config.services.ordering;
      lastReceivedHeaders = undefined;
      lastReceivedBody = undefined;
      lastRawBytesLength = 0;

      const upstreamApp = express();
      upstreamApp.use((req, _res, next) => {
        req.on('data', (chunk: Buffer) => {
          lastRawBytesLength += chunk.length;
        });
        next();
      });
      upstreamApp.use(express.json());
      upstreamApp.all('*', (req, res) => {
        lastReceivedHeaders = req.headers;
        lastReceivedBody = req.body;
        res.status(200).json({
          ok: true,
          method: req.method,
          path: req.path,
          receivedBody: req.body,
          contentLength: req.headers['content-length'] ?? null,
        });
      });

      upstreamServer = http.createServer(upstreamApp);
      upstreamServer.listen(0, () => {
        const port = (upstreamServer.address() as any).port;
        config.services.ordering = `http://localhost:${port}`;
        app = createApp();
        done();
      });
    });

    afterEach((done) => {
      config.services.ordering = originalOrderingUrl;
      if (upstreamServer) {
        (upstreamServer as any).closeAllConnections?.();
        upstreamServer.close(() => done());
      } else {
        done();
      }
    });

    test('29. POST /v1/cart/confirm con cuerpo "{}" explícito no se cuelga y reenvía "{}" con Content-Length: 2', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer', sessionId: 's1' }, TEST_SECRET);
      const start = Date.now();

      const res = await request(app)
        .post('/v1/cart/confirm')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('{}')
        .timeout(500);

      const elapsed = Date.now() - start;
      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(500);
      expect(res.body.receivedBody).toEqual({});
      expect(lastReceivedHeaders?.['content-length']).toBe('2');
      expect(lastRawBytesLength).toBe(2);
    });

    test('30. POST y PATCH con cuerpo con datos reenvían el JSON intacto y Content-Length consistente', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'admin', sessionId: 's1' }, TEST_SECRET);
      const payload = { tableId: 'T-1', quantity: 2 };
      const expectedLength = String(Buffer.byteLength(JSON.stringify(payload)));

      const postRes = await request(app)
        .post('/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .timeout(500);

      expect(postRes.status).toBe(200);
      expect(postRes.body.receivedBody).toEqual(payload);
      expect(lastReceivedHeaders?.['content-length']).toBe(expectedLength);

      const patchPayload = { status: 'PREPARING' };
      const expectedPatchLength = String(Buffer.byteLength(JSON.stringify(patchPayload)));

      const patchRes = await request(app)
        .patch('/v1/orders/ord-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send(patchPayload)
        .timeout(500);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.receivedBody).toEqual(patchPayload);
      expect(lastReceivedHeaders?.['content-length']).toBe(expectedPatchLength);
    });

    test('31. POST y PATCH sin cuerpo (sin Content-Length ni Content-Type) no se cuelgan y responden rápido', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'waiter', sessionId: 's1' }, TEST_SECRET);

      const postRes = await request(app)
        .post('/v1/cart/confirm')
        .set('Authorization', `Bearer ${token}`)
        .timeout(500);

      expect(postRes.status).toBe(200);
      expect(lastRawBytesLength).toBe(0);

      const patchRes = await request(app)
        .patch('/v1/service-calls/sc-1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .timeout(500);

      expect(patchRes.status).toBe(200);
      expect(lastRawBytesLength).toBe(0);
    });

    test('32. GET y DELETE sin cuerpo no envían body artificial ni se cuelgan', async () => {
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'customer', sessionId: 's1' }, TEST_SECRET);

      const getRes = await request(app)
        .get('/v1/cart')
        .set('Authorization', `Bearer ${token}`)
        .timeout(500);

      expect(getRes.status).toBe(200);
      expect(lastRawBytesLength).toBe(0);
      expect(lastReceivedHeaders?.['content-length']).toBeUndefined();

      const delRes = await request(app)
        .delete('/v1/cart/items/item-1')
        .set('Authorization', `Bearer ${token}`)
        .timeout(500);

      expect(delRes.status).toBe(200);
      expect(lastRawBytesLength).toBe(0);
    });
  });

  describe('U4: Operaciones en lote de mesas (/v1/tables/batch*)', () => {
    const batchRoutes = [
      { method: 'post' as const, path: '/v1/tables/batch', upstreamPath: '/tables/batch', body: { prefix: 'M-', startNumber: 1, count: 5 } },
      { method: 'patch' as const, path: '/v1/tables/batch', upstreamPath: '/tables/batch', body: { ids: ['t-1', 't-2'], zone: 'Terraza' } },
      { method: 'post' as const, path: '/v1/tables/batch/delete', upstreamPath: '/tables/batch/delete', body: { ids: ['t-1', 't-2'] } },
    ];

    test('33. Las rutas /v1/tables/batch* están declaradas en routeTable ANTES de /v1/tables/:tableId*', () => {
      const firstTableParamIdx = routeTable.findIndex((r) => r.path.startsWith('/v1/tables/:tableId'));
      const batchDeleteIdx = routeTable.findIndex((r) => r.method === 'POST' && r.path === '/v1/tables/batch/delete');
      const batchPostIdx = routeTable.findIndex((r) => r.method === 'POST' && r.path === '/v1/tables/batch');
      const batchPatchIdx = routeTable.findIndex((r) => r.method === 'PATCH' && r.path === '/v1/tables/batch');

      expect(firstTableParamIdx).toBeGreaterThan(-1);
      expect(batchDeleteIdx).toBeGreaterThan(-1);
      expect(batchPostIdx).toBeGreaterThan(-1);
      expect(batchPatchIdx).toBeGreaterThan(-1);

      expect(batchDeleteIdx).toBeLessThan(firstTableParamIdx);
      expect(batchPostIdx).toBeLessThan(firstTableParamIdx);
      expect(batchPatchIdx).toBeLessThan(firstTableParamIdx);
    });

    test.each(batchRoutes)(
      '34. $method $path sin token JWT -> 401 UNAUTHORIZED',
      async ({ method, path, body }) => {
        const res = await request(app)[method](path).send(body);
        expect(res.status).toBe(401);
        expect(res.body.error?.code).toBe('UNAUTHORIZED');
      }
    );

    test.each(batchRoutes)(
      '35. $method $path con token de rol staff -> 403 FORBIDDEN',
      async ({ method, path, body }) => {
        const staffToken = jwt.sign({ userId: 'u-staff', tenantId: 't-1', role: 'waiter' }, TEST_SECRET);
        const res = await request(app)[method](path)
          .set('Authorization', `Bearer ${staffToken}`)
          .send(body);

        expect(res.status).toBe(403);
        expect(res.body.error?.code).toBe('FORBIDDEN');
      }
    );

    test.each(batchRoutes)(
      '36. $method $path con rol admin y manager hace proxy exitoso al upstream session',
      async ({ method, path, upstreamPath, body }) => {
        for (const role of ['admin', 'manager']) {
          const token = jwt.sign({ userId: `u-${role}`, tenantId: 't-1', role }, TEST_SECRET);
          const upstream = nock('http://localhost:4003', {
            reqheaders: {
              'x-user-id': `u-${role}`,
              'x-tenant-id': 't-1',
              'x-user-role': role,
            },
          })[method](upstreamPath, body).reply(200, { ok: true, role });

          const res = await request(app)[method](path)
            .set('Authorization', `Bearer ${token}`)
            .send(body);

          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          expect(res.body).toEqual({ ok: true, role });
        }
      }
    );

    test('37. PATCH /v1/tables/batch llega al upstream session como PATCH /tables/batch con body JSON íntegro (no capturado por :tableId)', async () => {
      const adminToken = jwt.sign({ userId: 'u-admin', tenantId: 'tenant-abc', role: 'admin' }, TEST_SECRET);
      const payload = { ids: ['tbl-1', 'tbl-2', 'tbl-3'], status: 'AVAILABLE', capacity: 6 };

      let capturedPath = '';
      let capturedBody: any = null;
      const upstream = nock('http://localhost:4003')
        .patch('/tables/batch')
        .reply(function (this: any, uri, requestBody) {
          capturedPath = uri;
          capturedBody = requestBody;
          return [200, { updatedCount: 3 }];
        });

      const res = await request(app)
        .patch('/v1/tables/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(upstream.isDone()).toBe(true);
      expect(res.status).toBe(200);
      expect(capturedPath).toBe('/tables/batch');
      expect(capturedBody).toEqual(payload);
      expect(res.body).toEqual({ updatedCount: 3 });
    });

    test.each(batchRoutes)(
      '38. $method $path reemplaza headers spoofeados (x-tenant-id, x-user-role) con los del JWT verificado',
      async ({ method, path, upstreamPath, body }) => {
        const managerToken = jwt.sign({ userId: 'u-mgr-real', tenantId: 'tenant-real', role: 'manager' }, TEST_SECRET);
        let capturedHeaders: Record<string, any> = {};

        const upstream = nock('http://localhost:4003')[method](upstreamPath, body).reply(function (this: any) {
          capturedHeaders = this.req.headers;
          return [200, { ok: true }];
        });

        const res = await request(app)[method](path)
          .set('Authorization', `Bearer ${managerToken}`)
          .set('x-tenant-id', 'spoofed-tenant')
          .set('x-user-role', 'admin')
          .send(body);

        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
        expect(capturedHeaders['x-tenant-id']).toBe('tenant-real');
        expect(capturedHeaders['x-user-role']).toBe('manager');
        expect(capturedHeaders['x-user-id']).toBe('u-mgr-real');
      }
    );
  });

  describe('U4 Matriz completa de autorización por ruta y rol (routeTable reconciliada + D1)', () => {
    const ALL_ROLES = ['admin', 'manager', 'waiter', 'cashier', 'monitor', 'customer'] as const;

    const SERVICE_URLS: Record<string, string> = {
      identity: 'http://localhost:4001',
      catalog: 'http://localhost:4002',
      session: 'http://localhost:4003',
      ordering: 'http://localhost:4004',
    };

    function materializePath(routePath: string): string {
      return routePath
        .replace(':sessionId', 'sess-mat-1')
        .replace(':tableId', 'tbl-mat-1')
        .replace(':cartItemId', 'item-mat-1')
        .replace(':file', 'sample.png')
        .replace(':id', 'id-mat-1');
    }

    test('39. La tabla de rutas reconciliada contiene las 62 rutas unificadas (54 de wip + 8 de main) sin duplicados de (method, path)', () => {
      expect(routeTable.length).toBe(62);
      const seen = new Set<string>();
      for (const r of routeTable) {
        const key = `${r.method || 'ALL'} ${r.path}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    });

    test('40. D1 explícito: GET /v1/identity/users autoriza admin y manager (y rechaza staff/waiter/cashier/monitor); mutaciones de identity/users autorizan solo admin y rechazan manager', async () => {
      // 1. GET /v1/identity/users
      for (const allowedRole of ['admin', 'manager']) {
        const token = jwt.sign({ userId: `u-${allowedRole}`, tenantId: 't-1', role: allowedRole }, TEST_SECRET);
        const upstream = nock('http://localhost:4001').get('/identity/users').reply(200, []);
        const res = await request(app).get('/v1/identity/users').set('Authorization', `Bearer ${token}`);
        expect(upstream.isDone()).toBe(true);
        expect(res.status).toBe(200);
      }

      for (const deniedRole of ['waiter', 'waiter', 'cashier', 'monitor']) {
        const token = jwt.sign({ userId: `u-${deniedRole}`, tenantId: 't-1', role: deniedRole }, TEST_SECRET);
        const res = await request(app).get('/v1/identity/users').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }

      // 2. Mutaciones de identity/users: POST /v1/identity/users, PATCH /v1/identity/users/:id, disable, enable, reset-password
      const adminOnlyMutations: Array<{ method: 'post' | 'patch'; path: string; upstreamPath: string }> = [
        { method: 'post', path: '/v1/identity/users', upstreamPath: '/identity/users' },
        { method: 'patch', path: '/v1/identity/users/usr-1', upstreamPath: '/identity/users/usr-1' },
        { method: 'post', path: '/v1/identity/users/usr-1/disable', upstreamPath: '/identity/users/usr-1/disable' },
        { method: 'post', path: '/v1/identity/users/usr-1/enable', upstreamPath: '/identity/users/usr-1/enable' },
        { method: 'post', path: '/v1/identity/users/usr-1/reset-password', upstreamPath: '/identity/users/usr-1/reset-password' },
      ];

      for (const mut of adminOnlyMutations) {
        // admin permitido
        const adminToken = jwt.sign({ userId: 'u-admin', tenantId: 't-1', role: 'admin' }, TEST_SECRET);
        const upstream = nock('http://localhost:4001')[mut.method](mut.upstreamPath).reply(200, { ok: true });
        const okRes = await request(app)[mut.method](mut.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});
        expect(upstream.isDone()).toBe(true);
        expect(okRes.status).toBe(200);

        // manager y demás roles rechazados con 403
        for (const deniedRole of ['manager', 'waiter', 'waiter', 'cashier', 'monitor']) {
          const deniedToken = jwt.sign({ userId: `u-${deniedRole}`, tenantId: 't-1', role: deniedRole }, TEST_SECRET);
          const forbiddenRes = await request(app)[mut.method](mut.path)
            .set('Authorization', `Bearer ${deniedToken}`)
            .send({});
          expect(forbiddenRes.status).toBe(403);
          expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');
        }
      }
    });

    test('41. Lotes de mesas y DELETE /v1/tables/:tableId permiten admin y manager y rechazan staff/waiter/cashier/monitor', async () => {
      const tableMgmtRoutes: Array<{ method: 'post' | 'patch' | 'delete'; path: string; upstreamPath: string }> = [
        { method: 'post', path: '/v1/tables/batch', upstreamPath: '/tables/batch' },
        { method: 'patch', path: '/v1/tables/batch', upstreamPath: '/tables/batch' },
        { method: 'post', path: '/v1/tables/batch/delete', upstreamPath: '/tables/batch/delete' },
        { method: 'patch', path: '/v1/tables/tbl-1', upstreamPath: '/tables/tbl-1' },
        { method: 'delete', path: '/v1/tables/tbl-1', upstreamPath: '/tables/tbl-1' },
      ];

      for (const route of tableMgmtRoutes) {
        for (const allowedRole of ['admin', 'manager']) {
          const token = jwt.sign({ userId: `u-${allowedRole}`, tenantId: 't-1', role: allowedRole }, TEST_SECRET);
          const upstream = nock('http://localhost:4003')[route.method](route.upstreamPath).reply(200, { ok: true });
          const res = await request(app)[route.method](route.path)
            .set('Authorization', `Bearer ${token}`)
            .send({});
          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
        }

        for (const deniedRole of ['waiter', 'waiter', 'cashier', 'monitor']) {
          const token = jwt.sign({ userId: `u-${deniedRole}`, tenantId: 't-1', role: deniedRole }, TEST_SECRET);
          const res = await request(app)[route.method](route.path)
            .set('Authorization', `Bearer ${token}`)
            .send({});
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      }
    });

    test('41b. Rutas operativas (checkout, sessions, tables, service-calls, orders/:id/status, tables/:id/qr) permiten waiter, cashier y monitor según la matriz reconciliada', async () => {
      const operationalCases: Array<{
        method: 'get' | 'post' | 'patch';
        path: string;
        upstreamUrl: string;
        upstreamPath: string;
        allowed: string[];
        denied: string[];
      }> = [
        {
          method: 'get',
          path: '/v1/checkout/sess-op-1',
          upstreamUrl: 'http://localhost:4004',
          upstreamPath: '/checkout/sess-op-1',
          allowed: ['admin', 'manager', 'waiter', 'cashier'],
          denied: ['monitor', 'customer'],
        },
        {
          method: 'post',
          path: '/v1/checkout/confirm',
          upstreamUrl: 'http://localhost:4004',
          upstreamPath: '/checkout/confirm',
          allowed: ['admin', 'manager', 'waiter', 'cashier'],
          denied: ['monitor', 'customer'],
        },
        {
          method: 'get',
          path: '/v1/sessions',
          upstreamUrl: 'http://localhost:4003',
          upstreamPath: '/sessions',
          allowed: ['admin', 'manager', 'waiter', 'cashier'],
          denied: ['monitor', 'customer'],
        },
        {
          method: 'patch',
          path: '/v1/sessions/sess-op-1/close',
          upstreamUrl: 'http://localhost:4003',
          upstreamPath: '/sessions/sess-op-1/close',
          allowed: ['admin', 'manager', 'waiter', 'cashier'],
          denied: ['monitor', 'customer'],
        },
        {
          method: 'get',
          path: '/v1/tables',
          upstreamUrl: 'http://localhost:4003',
          upstreamPath: '/tables',
          allowed: ['admin', 'manager', 'waiter', 'cashier', 'monitor'],
          denied: ['customer'],
        },
        {
          method: 'get',
          path: '/v1/service-calls',
          upstreamUrl: 'http://localhost:4004',
          upstreamPath: '/service-calls',
          allowed: ['admin', 'manager', 'waiter', 'monitor', 'cashier'],
          denied: ['customer'],
        },
        {
          method: 'patch',
          path: '/v1/service-calls/sc-op-1/resolve',
          upstreamUrl: 'http://localhost:4004',
          upstreamPath: '/service-calls/sc-op-1/resolve',
          allowed: ['admin', 'manager', 'waiter', 'monitor', 'cashier'],
          denied: ['customer'],
        },
        {
          method: 'patch',
          path: '/v1/orders/ord-op-1/status',
          upstreamUrl: 'http://localhost:4004',
          upstreamPath: '/orders/ord-op-1/status',
          allowed: ['admin', 'manager', 'waiter', 'monitor'],
          denied: ['cashier', 'customer'],
        },
        {
          method: 'get',
          path: '/v1/tables/tbl-op-1/qr',
          upstreamUrl: 'http://localhost:4003',
          upstreamPath: '/tables/tbl-op-1/qr',
          allowed: ['admin', 'manager', 'waiter'],
          denied: ['cashier', 'monitor', 'customer'],
        },
      ];

      for (const tc of operationalCases) {
        for (const role of tc.allowed) {
          const token = jwt.sign({ userId: `u-${role}`, tenantId: 't-1', role }, TEST_SECRET);
          const upstream = nock(tc.upstreamUrl)[tc.method](tc.upstreamPath).reply(200, { ok: true, role });
          const res = await request(app)[tc.method](tc.path).set('Authorization', `Bearer ${token}`).send({});
          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
        }
        for (const role of tc.denied) {
          const token = jwt.sign({ userId: `u-${role}`, tenantId: 't-1', role }, TEST_SECRET);
          const res = await request(app)[tc.method](tc.path).set('Authorization', `Bearer ${token}`).send({});
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      }
    });

    test('42. Recorrido exhaustivo de cada ruta de routeTable verificando roles autorizados (200) y rechazados (403)', async () => {
      for (const route of routeTable) {
        const httpMethod = ((route.method && route.method !== 'ALL' ? route.method : 'GET').toLowerCase()) as
          | 'get'
          | 'post'
          | 'patch'
          | 'put'
          | 'delete';
        const fullPath = materializePath(route.path);
        const upstreamPath = fullPath.replace(/^\/v1/, '');
        const baseUrl = SERVICE_URLS[route.targetService];

        if (!route.auth) {
          const upstream = nock(baseUrl)[httpMethod](upstreamPath).reply(200, { ok: true });
          const res = await request(app)[httpMethod](fullPath);
          expect(upstream.isDone()).toBe(true);
          expect(res.status).toBe(200);
          continue;
        }

        // Ruta autenticada sin token -> 401
        const unauthRes = await request(app)[httpMethod](fullPath);
        expect(unauthRes.status).toBe(401);

        for (const role of ALL_ROLES) {
          const token = jwt.sign({ userId: `u-${role}`, tenantId: 't-1', role }, TEST_SECRET);
          const isAllowed =
            !route.requiredRoles ||
            route.requiredRoles.length === 0 ||
            route.requiredRoles.map((r) => r.toLowerCase()).includes(role.toLowerCase());

          if (isAllowed) {
            const upstream = nock(baseUrl)[httpMethod](upstreamPath).reply(200, { ok: true, route: route.path, role });
            const res = await request(app)[httpMethod](fullPath).set('Authorization', `Bearer ${token}`);
            expect(upstream.isDone()).toBe(true);
            expect(res.status).toBe(200);
          } else {
            const res = await request(app)[httpMethod](fullPath).set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
          }
        }
      }
    });
  });
});
