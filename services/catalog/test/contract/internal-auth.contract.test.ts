import request from 'supertest';
import { createCatalogApp } from '../../src/app';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryModifierGroupRepository,
} from '../../src/infrastructure/fakes/InMemoryCatalogAdapters';

describe('Catalog Internal Auth Middleware Contract (R08)', () => {
  const origSecret = process.env.INTERNAL_SHARED_SECRET;
  let app: any;

  beforeAll(async () => {
    process.env.INTERNAL_SHARED_SECRET = 'test-catalog-secret-2026';
    app = await createCatalogApp({
      categoryRepo: new InMemoryCategoryRepository(),
      productRepo: new InMemoryProductRepository(),
      modifierGroupRepo: new InMemoryModifierGroupRepository(),
    });
  });

  afterAll(() => {
    if (origSecret !== undefined) {
      process.env.INTERNAL_SHARED_SECRET = origSecret;
    } else {
      delete process.env.INTERNAL_SHARED_SECRET;
    }
  });

  it('exenta /health permitiendo verificación de liveness sin token (200 OK)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', postgres: 'up' });
  });

  it('bloquea llamadas sin x-internal-token con 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ categories { id } }' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  });

  it('bloquea llamadas con x-internal-token incorrecto con 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('x-internal-token', 'token-invalido')
      .send({ query: '{ categories { id } }' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  });

  it('permite llamadas con x-internal-token válido coincidente', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('x-internal-token', 'test-catalog-secret-2026')
      .set('x-tenant-id', 'test-tenant')
      .send({ query: '{ categories { id } }' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
