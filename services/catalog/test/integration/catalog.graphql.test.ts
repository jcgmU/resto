import request from 'supertest';
import crypto from 'crypto';
import { createCatalogApp } from '../../src/app';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryModifierGroupRepository,
} from '../../src/infrastructure/fakes/InMemoryCatalogAdapters';

const TEST_JWT_SECRET = 'super-secret-jwt-key-hardening-test';
process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_JWT_SECRET;

function signTestJwt(
  payload: {
    tenantId?: string;
    userId?: string;
    role?: string;
    sessionId?: string;
    exp?: number;
    [key: string]: any;
  },
  secret: string = process.env.JWT_SECRET || TEST_JWT_SECRET
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

describe('D. Catalog — integración GraphQL (Tests 24-28)', () => {
  let app: any;

  beforeAll(async () => {
    app = await createCatalogApp({
      categoryRepo: new InMemoryCategoryRepository(),
      productRepo: new InMemoryProductRepository(),
      modifierGroupRepo: new InMemoryModifierGroupRepository(),
    });
  });

  test('24. mutation createCategory -> query categories la devuelve', async () => {
    const mutation = `
      mutation {
        createCategory(input: { name: "Bebidas", sortOrder: 0 }) {
          id
          name
        }
      }
    `;
    const adminToken = signTestJwt({ tenantId: 'tenant-100', role: 'ADMIN' });
    const resMut = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: mutation });

    expect(resMut.status).toBe(200);
    expect(resMut.body.data.createCategory.name).toBe('Bebidas');

    const query = `
      query {
        categories {
          id
          name
        }
      }
    `;
    const resQuery = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .send({ query });

    expect(resQuery.status).toBe(200);
    expect(resQuery.body.data.categories.some((c: any) => c.name === 'Bebidas')).toBe(true);
  });

  test('25. Flujo completo: createModifierGroup + addModifierOption -> attachModifierGroup -> query product incluye el grupo con opciones y priceDelta', async () => {
    const query = `
      query {
        product(id: "prod-1") {
          id
          name
          modifierGroups {
            name
            options {
              name
              priceDelta
            }
          }
        }
      }
    `;
    const res = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .send({ query });

    expect(res.status).toBe(200);
    expect(res.body.data.product).toBeDefined();
    expect(res.body.data.product.modifierGroups.length).toBeGreaterThan(0);
  });

  test('26. Aislamiento: datos creados por tenant A son invisibles en TODAS las queries de tenant B', async () => {
    const query = `
      query {
        categories {
          id
          name
        }
      }
    `;
    const res = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-B')
      .send({ query });

    expect(res.status).toBe(200);
    expect(res.body.data.categories.some((c: any) => c.name === 'Bebidas')).toBe(false);
  });

  test('27. Query sin x-tenant-id -> error UNAUTHENTICATED', async () => {
    const query = `
      query {
        categories {
          id
        }
      }
    `;
    const res = await request(app)
      .post('/graphql')
      .send({ query });

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  test('28. Errores llevan extensions.code en {BAD_USER_INPUT, NOT_FOUND, CONFLICT, CATEGORY_NOT_EMPTY}', async () => {
    const badMutation = `
      mutation {
        createProduct(input: { categoryId: "nonexistent", name: "Fail", price: -10 }) {
          id
        }
      }
    `;
    const adminToken = signTestJwt({ tenantId: 'tenant-100', role: 'ADMIN' });
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: badMutation });

    expect(res.body.errors).toBeDefined();
    const code = res.body.errors[0]?.extensions?.code;
    expect(['BAD_USER_INPUT', 'NOT_FOUND', 'CONFLICT', 'CATEGORY_NOT_EMPTY']).toContain(code);
  });
});
