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
    test('15. GET /health -> 200 con { status: "ok" } y entradas por servicio', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('services');
      expect(res.body.services).toHaveProperty('gateway', 'ok');
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

    test('24b. U5: GET /v1/identity/users sin token -> 401; con token MANAGER -> 403; con token ADMIN -> 200 proxy a identity', async () => {
      // Sin token -> 401
      const unauthRes = await request(app).get('/v1/identity/users');
      expect(unauthRes.status).toBe(401);

      // Con token MANAGER -> 403
      const managerToken = jwt.sign({ userId: 'u-mgr', tenantId: 't-1', role: 'manager' }, TEST_SECRET);
      const forbiddenRes = await request(app)
        .get('/v1/identity/users')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

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
      const staffToken = jwt.sign({ userId: 'u-staff', tenantId: 'real-tenant', role: 'staff' }, TEST_SECRET);
      const upstream = nock('http://localhost:4003', {
        reqheaders: {
          'x-user-id': 'u-staff',
          'x-tenant-id': 'real-tenant',
          'x-user-role': 'staff',
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
      const token = jwt.sign({ userId: 'u-pass', tenantId: 't-1', role: 'staff' }, TEST_SECRET);
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
      const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'staff', sessionId: 's1' }, TEST_SECRET);

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
        const staffToken = jwt.sign({ userId: 'u-staff', tenantId: 't-1', role: 'staff' }, TEST_SECRET);
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
});
