import request from 'supertest';
import { createCatalogApp } from '../../src/app';
import {
  ensureContractEnv,
  getTestPrisma,
  truncateCatalogDb,
  disconnectTestPrisma,
} from './contract-helper';
import { PrismaCategoryRepository } from '../../src/infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from '../../src/infrastructure/persistence/PrismaProductRepository';
import { PrismaModifierGroupRepository } from '../../src/infrastructure/persistence/PrismaModifierGroupRepository';

describe('Product prepTimeMinutes, sortOrder & imageUrl Contract Tests (Postgres Real)', () => {
  let app: any;
  const tenantId = 'tenant-preptime-test';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-role': 'ADMIN',
  };

  beforeAll(async () => {
    await ensureContractEnv();
    const prisma = getTestPrisma();
    app = await createCatalogApp({
      categoryRepo: new PrismaCategoryRepository(prisma),
      productRepo: new PrismaProductRepository(prisma),
      modifierGroupRepo: new PrismaModifierGroupRepository(prisma),
    });
  });

  beforeEach(async () => {
    await truncateCatalogDb();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('1. Crea producto con prepTimeMinutes, sortOrder e imageUrl y lo recupera vía GraphQL', async () => {
    // 1. Crear categoría previa
    const createCatRes = await request(app)
      .post('/graphql')
      .set(headers)
      .send({
        query: `
          mutation {
            createCategory(input: { name: "Pizzas", sortOrder: 1 }) {
              id
              name
              sortOrder
            }
          }
        `,
      });

    expect(createCatRes.body.errors).toBeUndefined();
    const categoryId = createCatRes.body.data.createCategory.id;

    // 2. Crear producto con prepTimeMinutes, imageUrl y sortOrder
    const createProdRes = await request(app)
      .post('/graphql')
      .set(headers)
      .send({
        query: `
          mutation CreateProd($input: CreateProductInput!) {
            createProduct(input: $input) {
              id
              name
              price
              imageUrl
              sortOrder
              prepTimeMinutes
              category {
                id
                name
              }
            }
          }
        `,
        variables: {
          input: {
            categoryId,
            name: 'Pizza Napolitana',
            price: 32000,
            imageUrl: '/uploads/pizza-napolitana.png',
            sortOrder: 10,
            prepTimeMinutes: 25,
          },
        },
      });

    expect(createProdRes.body.errors).toBeUndefined();
    const created = createProdRes.body.data.createProduct;
    expect(created.name).toBe('Pizza Napolitana');
    expect(created.price).toBe(32000);
    expect(created.imageUrl).toBe('/uploads/pizza-napolitana.png');
    expect(created.sortOrder).toBe(10);
    expect(created.prepTimeMinutes).toBe(25);
    expect(created.category.name).toBe('Pizzas');

    const productId = created.id;

    // 3. Recuperar producto individual
    const queryProdRes = await request(app)
      .post('/graphql')
      .set(headers)
      .send({
        query: `
          query GetProd($id: ID!) {
            product(id: $id) {
              id
              name
              imageUrl
              sortOrder
              prepTimeMinutes
            }
          }
        `,
        variables: { id: productId },
      });

    expect(queryProdRes.body.errors).toBeUndefined();
    const fetched = queryProdRes.body.data.product;
    expect(fetched.prepTimeMinutes).toBe(25);
    expect(fetched.imageUrl).toBe('/uploads/pizza-napolitana.png');
    expect(fetched.sortOrder).toBe(10);

    // 4. Actualizar prepTimeMinutes y sortOrder
    const updateProdRes = await request(app)
      .post('/graphql')
      .set(headers)
      .send({
        query: `
          mutation UpdateProd($id: ID!, $input: UpdateProductInput!) {
            updateProduct(id: $id, input: $input) {
              id
              name
              prepTimeMinutes
              sortOrder
              imageUrl
            }
          }
        `,
        variables: {
          id: productId,
          input: {
            prepTimeMinutes: 30,
            sortOrder: 2,
            imageUrl: '/uploads/pizza-updated.webp',
          },
        },
      });

    expect(updateProdRes.body.errors).toBeUndefined();
    const updated = updateProdRes.body.data.updateProduct;
    expect(updated.prepTimeMinutes).toBe(30);
    expect(updated.sortOrder).toBe(2);
    expect(updated.imageUrl).toBe('/uploads/pizza-updated.webp');
  });

  it('2. Las consultas de categorías y productos ordenan por sortOrder ASC, name ASC', async () => {
    // Crear categorías desordenadas
    const catQueries = [
      { name: 'Postres', sortOrder: 2 },
      { name: 'Bebidas Calientes', sortOrder: 1 },
      { name: 'Bebidas Frías', sortOrder: 1 },
      { name: 'Entradas', sortOrder: 0 },
    ];

    for (const c of catQueries) {
      await request(app)
        .post('/graphql')
        .set(headers)
        .send({
          query: `mutation { createCategory(input: { name: "${c.name}", sortOrder: ${c.sortOrder} }) { id } }`,
        });
    }

    const resCats = await request(app)
      .post('/graphql')
      .set(headers)
      .send({ query: '{ categories { id name sortOrder } }' });

    expect(resCats.body.errors).toBeUndefined();
    const catNames = resCats.body.data.categories.map((c: any) => c.name);
    // sortOrder 0: Entradas
    // sortOrder 1: Bebidas Calientes, Bebidas Frías (orden alfabético por name ASC)
    // sortOrder 2: Postres
    expect(catNames).toEqual(['Entradas', 'Bebidas Calientes', 'Bebidas Frías', 'Postres']);

    // Crear productos en la primera categoría con varios sortOrder y nombres
    const catId = resCats.body.data.categories[0].id;
    const prodQueries = [
      { name: 'Zanahoria Asada', sortOrder: 1, price: 10000 },
      { name: 'Alitas BBQ', sortOrder: 1, price: 15000 },
      { name: 'Sopa del Día', sortOrder: 0, price: 8000 },
      { name: 'Carpaccio', sortOrder: 0, price: 20000 },
    ];

    for (const p of prodQueries) {
      await request(app)
        .post('/graphql')
        .set(headers)
        .send({
          query: `
            mutation {
              createProduct(input: {
                categoryId: "${catId}",
                name: "${p.name}",
                price: ${p.price},
                sortOrder: ${p.sortOrder}
              }) { id }
            }
          `,
        });
    }

    const resProds = await request(app)
      .post('/graphql')
      .set(headers)
      .send({ query: '{ products { name sortOrder } }' });

    expect(resProds.body.errors).toBeUndefined();
    const prodNames = resProds.body.data.products.map((p: any) => p.name);
    // sortOrder 0: Carpaccio, Sopa del Día (name ASC)
    // sortOrder 1: Alitas BBQ, Zanahoria Asada (name ASC)
    expect(prodNames).toEqual(['Carpaccio', 'Sopa del Día', 'Alitas BBQ', 'Zanahoria Asada']);
  });
});
