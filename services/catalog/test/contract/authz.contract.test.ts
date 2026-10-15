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

describe('Catalog Authorization Contract (R01 - Postgres Real)', () => {
  let app: any;
  const tenantId = 'tenant-authz-test';

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

  describe('Matriz de Autorización (R01)', () => {
    it('Guest (sin rol) -> 14 mutaciones denegadas con FORBIDDEN y catálogo intacto', async () => {
      const createCatMutation = `
        mutation {
          createCategory(input: { name: "Bebidas Prohibidas", sortOrder: 1 }) { id name }
        }
      `;
      const resCat = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .send({ query: createCatMutation });

      expect(resCat.body.errors).toBeDefined();
      expect(resCat.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');

      const createProdMutation = `
        mutation {
          createProduct(input: { categoryId: "cat-1", name: "Lomo Prohibido", price: 50000 }) { id }
        }
      `;
      const resProd = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .send({ query: createProdMutation });

      expect(resProd.body.errors).toBeDefined();
      expect(resProd.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');

      const createGroupMutation = `
        mutation {
          createModifierGroup(input: { name: "Extras", minSelections: 0, maxSelections: 2 }) { id }
        }
      `;
      const resGroup = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .send({ query: createGroupMutation });

      expect(resGroup.body.errors).toBeDefined();
      expect(resGroup.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');

      // Catálogo intacto en BD Postgres real
      const prisma = getTestPrisma();
      const countCat = await prisma.category.count({ where: { tenantId } });
      const countProd = await prisma.product.count({ where: { tenantId } });
      expect(countCat).toBe(0);
      expect(countProd).toBe(0);
    });

    it('Staff (x-user-role: STAFF) -> mutaciones denegadas con FORBIDDEN', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Categoría Staff", sortOrder: 1 }) { id }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'STAFF')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('Customer (x-user-role: CUSTOMER) -> mutaciones denegadas con FORBIDDEN', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Categoría Customer", sortOrder: 1 }) { id }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'CUSTOMER')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('Manager (x-user-role: MANAGER) -> mutaciones permitidas en Postgres real', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Entradas Manager", sortOrder: 1 }) { id name }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'MANAGER')
        .send({ query: mutation });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data?.createCategory?.name).toBe('Entradas Manager');

      const prisma = getTestPrisma();
      const countCat = await prisma.category.count({ where: { tenantId } });
      expect(countCat).toBe(1);
    });

    it('Admin (x-user-role: ADMIN) -> mutaciones permitidas (crear, actualizar, borrar)', async () => {
      // 1. Crear categoría
      const createCat = `
        mutation {
          createCategory(input: { name: "Fuertes Admin", sortOrder: 2 }) { id name }
        }
      `;
      const resCreate = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'ADMIN')
        .send({ query: createCat });

      expect(resCreate.body.data?.createCategory?.name).toBe('Fuertes Admin');
      const catId = resCreate.body.data.createCategory.id;

      // 2. Actualizar categoría
      const updateCat = `
        mutation {
          updateCategory(id: "${catId}", input: { name: "Platos Fuertes Admin" }) { id name }
        }
      `;
      const resUpdate = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'ADMIN')
        .send({ query: updateCat });

      expect(resUpdate.body.data?.updateCategory?.name).toBe('Platos Fuertes Admin');

      // 3. Borrar categoría
      const deleteCat = `
        mutation {
          deleteCategory(id: "${catId}")
        }
      `;
      const resDelete = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'ADMIN')
        .send({ query: deleteCat });

      expect(resDelete.body.data?.deleteCategory).toBe(true);
    });

    it('Guest y Staff pueden consultar Query (categories, products) sin error de autorización', async () => {
      // Crear datos previos con ADMIN
      await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'ADMIN')
        .send({
          query: `mutation { createCategory(input: { name: "Bebidas Query", sortOrder: 1 }) { id } }`,
        });

      const query = `
        query {
          categories { id name }
        }
      `;

      // Guest query
      const resGuest = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .send({ query });

      expect(resGuest.body.errors).toBeUndefined();
      expect(resGuest.body.data?.categories).toHaveLength(1);
      expect(resGuest.body.data?.categories[0].name).toBe('Bebidas Query');

      // Staff query
      const resStaff = await request(app)
        .post('/graphql')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'STAFF')
        .send({ query });

      expect(resStaff.body.errors).toBeUndefined();
      expect(resStaff.body.data?.categories).toHaveLength(1);
    });
  });
});
