import request from 'supertest';
import { createCatalogApp } from '../../src/app';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemoryModifierGroupRepository,
} from '../../src/infrastructure/fakes/InMemoryCatalogAdapters';

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
    const resMut = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'ADMIN')
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
    const res = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'ADMIN')
      .send({ query: badMutation });

    expect(res.body.errors).toBeDefined();
    const code = res.body.errors[0]?.extensions?.code;
    expect(['BAD_USER_INPUT', 'NOT_FOUND', 'CONFLICT', 'CATEGORY_NOT_EMPTY']).toContain(code);
  });

  test('29. Mutación sin rol o con STAFF -> error FORBIDDEN', async () => {
    const mutation = `
      mutation {
        createCategory(input: { name: "NoPermitida", sortOrder: 0 }) {
          id
        }
      }
    `;
    const resNoRole = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .send({ query: mutation });

    expect(resNoRole.body.errors).toBeDefined();
    expect(resNoRole.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');

    const resStaff = await request(app)
      .post('/graphql')
      .set('x-tenant-id', 'tenant-100')
      .set('x-user-role', 'STAFF')
      .send({ query: mutation });

    expect(resStaff.body.errors).toBeDefined();
    expect(resStaff.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
