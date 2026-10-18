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

  const ALL_14_MUTATIONS: { name: string; query: string }[] = [
    {
      name: 'createCategory',
      query: `mutation { createCategory(input: { name: "Bebidas Prohibidas", sortOrder: 1 }) { id name } }`,
    },
    {
      name: 'updateCategory',
      query: `mutation { updateCategory(id: "cat-fake", input: { name: "Bebidas Fake" }) { id name } }`,
    },
    {
      name: 'deleteCategory',
      query: `mutation { deleteCategory(id: "cat-fake") }`,
    },
    {
      name: 'createProduct',
      query: `mutation { createProduct(input: { categoryId: "cat-fake", name: "Lomo Prohibido", price: 50000 }) { id } }`,
    },
    {
      name: 'updateProduct',
      query: `mutation { updateProduct(id: "prod-fake", input: { name: "Lomo Fake" }) { id } }`,
    },
    {
      name: 'deleteProduct',
      query: `mutation { deleteProduct(id: "prod-fake") }`,
    },
    {
      name: 'setProductAvailability',
      query: `mutation { setProductAvailability(id: "prod-fake", isAvailable: false) { id } }`,
    },
    {
      name: 'createModifierGroup',
      query: `mutation { createModifierGroup(input: { name: "Extras Prohibidos", minSelections: 0, maxSelections: 2 }) { id } }`,
    },
    {
      name: 'updateModifierGroup',
      query: `mutation { updateModifierGroup(id: "mod-fake", input: { name: "Extras Modificados" }) { id } }`,
    },
    {
      name: 'deleteModifierGroup',
      query: `mutation { deleteModifierGroup(id: "mod-fake") }`,
    },
    {
      name: 'addModifierOption',
      query: `mutation { addModifierOption(groupId: "mod-fake", input: { name: "Opcion Prohibida", priceDelta: 2000 }) { id } }`,
    },
    {
      name: 'removeModifierOption',
      query: `mutation { removeModifierOption(id: "opt-fake") }`,
    },
    {
      name: 'attachModifierGroup',
      query: `mutation { attachModifierGroup(productId: "prod-fake", groupId: "mod-fake") { id } }`,
    },
    {
      name: 'detachModifierGroup',
      query: `mutation { detachModifierGroup(productId: "prod-fake", groupId: "mod-fake") { id } }`,
    },
  ];

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

  async function assertCatalogEmpty() {
    const prisma = getTestPrisma();
    const countCat = await prisma.category.count({ where: { tenantId } });
    const countProd = await prisma.product.count({ where: { tenantId } });
    const countGrp = await prisma.modifierGroup.count({ where: { tenantId } });
    expect(countCat).toBe(0);
    expect(countProd).toBe(0);
    expect(countGrp).toBe(0);
  }

  async function executeFullMutationLifecycle(role: 'ADMIN' | 'MANAGER', prefix: string) {
    // 1. createCategory
    const resCat = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { createCategory(input: { name: "${prefix} Bebidas", sortOrder: 1 }) { id name } }`,
      });
    expect(resCat.body.errors).toBeUndefined();
    expect(resCat.body.data?.createCategory?.name).toBe(`${prefix} Bebidas`);
    const catId = resCat.body.data.createCategory.id;

    // 2. updateCategory
    const resUpCat = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { updateCategory(id: "${catId}", input: { name: "${prefix} Bebidas Frías" }) { id name } }`,
      });
    expect(resUpCat.body.errors).toBeUndefined();
    expect(resUpCat.body.data?.updateCategory?.name).toBe(`${prefix} Bebidas Frías`);

    // 3. createProduct
    const resProd = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { createProduct(input: { categoryId: "${catId}", name: "${prefix} Limonada", price: 12000 }) { id name price } }`,
      });
    expect(resProd.body.errors).toBeUndefined();
    expect(resProd.body.data?.createProduct?.name).toBe(`${prefix} Limonada`);
    const prodId = resProd.body.data.createProduct.id;

    // 4. updateProduct
    const resUpProd = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { updateProduct(id: "${prodId}", input: { name: "${prefix} Limonada Coco", price: 15000 }) { id name price } }`,
      });
    expect(resUpProd.body.errors).toBeUndefined();
    expect(resUpProd.body.data?.updateProduct?.name).toBe(`${prefix} Limonada Coco`);

    // 5. setProductAvailability
    const resAvail = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { setProductAvailability(id: "${prodId}", isAvailable: false) { id isAvailable } }`,
      });
    expect(resAvail.body.errors).toBeUndefined();
    expect(resAvail.body.data?.setProductAvailability?.isAvailable).toBe(false);

    // 6. createModifierGroup
    const resGrp = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { createModifierGroup(input: { name: "${prefix} Endulzantes", minSelections: 0, maxSelections: 1 }) { id name } }`,
      });
    expect(resGrp.body.errors).toBeUndefined();
    expect(resGrp.body.data?.createModifierGroup?.name).toBe(`${prefix} Endulzantes`);
    const grpId = resGrp.body.data.createModifierGroup.id;

    // 7. updateModifierGroup
    const resUpGrp = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { updateModifierGroup(id: "${grpId}", input: { name: "${prefix} Opciones Endulzante" }) { id name } }`,
      });
    expect(resUpGrp.body.errors).toBeUndefined();
    expect(resUpGrp.body.data?.updateModifierGroup?.name).toBe(`${prefix} Opciones Endulzante`);

    // 8. addModifierOption
    const resOpt = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { addModifierOption(groupId: "${grpId}", input: { name: "${prefix} Miel", priceDelta: 1500 }) { id name priceDelta } }`,
      });
    expect(resOpt.body.errors).toBeUndefined();
    expect(resOpt.body.data?.addModifierOption?.name).toBe(`${prefix} Miel`);
    const optId = resOpt.body.data.addModifierOption.id;

    // 9. attachModifierGroup
    const resAttach = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { attachModifierGroup(productId: "${prodId}", groupId: "${grpId}") { id } }`,
      });
    expect(resAttach.body.errors).toBeUndefined();

    // 10. detachModifierGroup
    const resDetach = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { detachModifierGroup(productId: "${prodId}", groupId: "${grpId}") { id } }`,
      });
    expect(resDetach.body.errors).toBeUndefined();

    // 11. removeModifierOption
    const resRemOpt = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { removeModifierOption(id: "${optId}") }`,
      });
    expect(resRemOpt.body.errors).toBeUndefined();
    expect(resRemOpt.body.data?.removeModifierOption).toBe(true);

    // 12. deleteModifierGroup
    const resDelGrp = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { deleteModifierGroup(id: "${grpId}") }`,
      });
    expect(resDelGrp.body.errors).toBeUndefined();
    expect(resDelGrp.body.data?.deleteModifierGroup).toBe(true);

    // 13. deleteProduct
    const resDelProd = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { deleteProduct(id: "${prodId}") }`,
      });
    expect(resDelProd.body.errors).toBeUndefined();
    expect(resDelProd.body.data?.deleteProduct).toBe(true);

    // 14. deleteCategory
    const resDelCat = await request(app)
      .post('/graphql')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', role)
      .send({
        query: `mutation { deleteCategory(id: "${catId}") }`,
      });
    expect(resDelCat.body.errors).toBeUndefined();
    expect(resDelCat.body.data?.deleteCategory).toBe(true);

    // Tras completar el ciclo completo y borrado, catálogo vuelve a quedar vacío
    await assertCatalogEmpty();
  }

  describe('Matriz de Autorización (R01)', () => {
    it('Guest (sin rol) -> las 14 mutaciones denegadas con FORBIDDEN y catálogo intacto', async () => {
      expect(ALL_14_MUTATIONS).toHaveLength(14);
      for (const m of ALL_14_MUTATIONS) {
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', tenantId)
          .send({ query: m.query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
      }

      await assertCatalogEmpty();
    });

    it('Staff (x-user-role: STAFF) -> las 14 mutaciones denegadas con FORBIDDEN y catálogo intacto', async () => {
      expect(ALL_14_MUTATIONS).toHaveLength(14);
      for (const m of ALL_14_MUTATIONS) {
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', 'STAFF')
          .send({ query: m.query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
      }

      await assertCatalogEmpty();
    });

    it('Customer (x-user-role: CUSTOMER) -> las 14 mutaciones denegadas con FORBIDDEN y catálogo intacto', async () => {
      expect(ALL_14_MUTATIONS).toHaveLength(14);
      for (const m of ALL_14_MUTATIONS) {
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', 'CUSTOMER')
          .send({ query: m.query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0]?.extensions?.code).toBe('FORBIDDEN');
      }

      await assertCatalogEmpty();
    });

    it('Manager (x-user-role: MANAGER) -> las 14 mutaciones permitidas (categorías, productos y modificadores)', async () => {
      await executeFullMutationLifecycle('MANAGER', 'Manager');
    });

    it('Admin (x-user-role: ADMIN) -> las 14 mutaciones permitidas (categorías, productos y modificadores)', async () => {
      await executeFullMutationLifecycle('ADMIN', 'Admin');
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
