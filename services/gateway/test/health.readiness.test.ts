import request from 'supertest';
import nock from 'nock';
import { createApp } from '../src/app';

const TEST_SECRET = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = TEST_SECRET;
process.env.IDENTITY_SERVICE_URL = 'http://localhost:4001';
process.env.CATALOG_SERVICE_URL = 'http://localhost:4002';
process.env.SESSION_SERVICE_URL = 'http://localhost:4003';
process.env.ORDERING_SERVICE_URL = 'http://localhost:4004';

describe('Gateway Health & Readiness (R12 / V09)', () => {
  let app: any;

  beforeEach(() => {
    nock.cleanAll();
    app = createApp();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  test('GET /health/live -> 200 live', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'live' });
  });

  test('GET /health -> 200 live (alias para compatibilidad)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'live' });
  });

  test('GET /health/ready -> 200 ready cuando los 4 upstreams están sanos', async () => {
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok', postgres: 'up' });
    nock('http://localhost:4002').get('/health').reply(200, { status: 'ok', postgres: 'up' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok', redis: 'up' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok', postgres: 'up', redis: 'up' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ready',
      services: {
        identity: 'up',
        catalog: 'up',
        session: 'up',
        ordering: 'up',
      },
    });
  });

  test('GET /health/ready -> 503 unready cuando catalog (o cualquier servicio) falla o está caído', async () => {
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok', postgres: 'up' });
    nock('http://localhost:4002').get('/health').reply(503, { status: 'error', postgres: 'down' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok', redis: 'up' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok', postgres: 'up', redis: 'up' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unready',
      services: {
        identity: 'up',
        catalog: 'down',
        session: 'up',
        ordering: 'up',
      },
    });
  });

  test('GET /health/ready -> 503 unready cuando identity falla', async () => {
    nock('http://localhost:4001').get('/health').reply(500);
    nock('http://localhost:4002').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unready');
    expect(res.body.services.identity).toBe('down');
  });

  test('GET /health/ready -> 503 unready cuando session falla', async () => {
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4002').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4003').get('/health').reply(503, { status: 'error' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unready');
    expect(res.body.services.session).toBe('down');
  });

  test('GET /health/ready -> 503 unready cuando ordering falla', async () => {
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4002').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4004').get('/health').reply(503, { status: 'error' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unready');
    expect(res.body.services.ordering).toBe('down');
  });

  test('GET /health/ready -> 503 unready cuando un servicio sufre error de red (ECONNREFUSED)', async () => {
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4002').get('/health').replyWithError('ECONNREFUSED');
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok' });

    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unready');
    expect(res.body.services.catalog).toBe('down');
  });

  test('GET /health/ready -> 200 recuperado cuando el servicio vuelve a estar sano', async () => {
    // 1. Catálogo caído inicialmente
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4002').get('/health').reply(503, { status: 'error', postgres: 'down' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok' });

    let res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unready');
    expect(res.body.services.catalog).toBe('down');

    // 2. Catálogo recuperado
    nock('http://localhost:4001').get('/health').reply(200, { status: 'ok', postgres: 'up' });
    nock('http://localhost:4002').get('/health').reply(200, { status: 'ok', postgres: 'up' });
    nock('http://localhost:4003').get('/health').reply(200, { status: 'ok', redis: 'up' });
    nock('http://localhost:4004').get('/health').reply(200, { status: 'ok', postgres: 'up', redis: 'up' });

    res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ready',
      services: {
        identity: 'up',
        catalog: 'up',
        session: 'up',
        ordering: 'up',
      },
    });
  });
});
