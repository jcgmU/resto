import request from 'supertest';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/client';
import { createCatalogApp } from '../src/app';
import { PrismaCategoryRepository } from '../src/infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from '../src/infrastructure/persistence/PrismaProductRepository';
import { PrismaModifierGroupRepository } from '../src/infrastructure/persistence/PrismaModifierGroupRepository';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test';

function signTestJwt(payload: {
  tenantId: string;
  role: string;
  userId?: string;
  exp?: number;
  [key: string]: any;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TEST_JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

describe('Catalog Tenant Isolation Real PostgreSQL Suite (U3)', () => {
  let app: any;
  let prisma: PrismaClient;

  const TENANT_A = `tenant-u3-a-${Date.now()}`;
  const TENANT_B = `tenant-u3-b-${Date.now()}`;

  let catAId: string;
  let catA2Id: string;
  let prodAId: string;
  let modGroupAId: string;

  let catBId: string;
  let prodBId: string;
  let modGroupBId: string;
  let adminTokenA: string;

  beforeAll(async () => {
    const url = process.env.CATALOG_DATABASE_URL;
    if (!url) {
      throw new Error(
        'Missing required env CATALOG_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url },
      },
    });
    await prisma.$connect();

    // 1. Seed Tenant A resources
    const catA = await prisma.category.create({
      data: {
        tenantId: TENANT_A,
        name: 'Categoria A1',
        sortOrder: 1,
        isActive: true,
      },
    });
    catAId = catA.id;

    const catA2 = await prisma.category.create({
      data: {
        tenantId: TENANT_A,
        name: 'Categoria A2',
        sortOrder: 2,
        isActive: true,
      },
    });
    catA2Id = catA2.id;

    const modGroupA = await prisma.modifierGroup.create({
      data: {
        tenantId: TENANT_A,
        name: 'Salsas A',
        minSelections: 0,
        maxSelections: 2,
        isRequired: false,
        options: {
          create: [{ name: 'Mayo A', priceDelta: 0.5, isDefault: false }],
        },
      },
    });
    modGroupAId = modGroupA.id;

    const prodA = await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        categoryId: catAId,
        name: 'Hamburguesa A',
        price: 10.0,
        isAvailable: true,
        sortOrder: 1,
      },
    });
    prodAId = prodA.id;

    // 2. Seed Tenant B resources
    const catB = await prisma.category.create({
      data: {
        tenantId: TENANT_B,
        name: 'Categoria B1',
        sortOrder: 1,
        isActive: true,
      },
    });
    catBId = catB.id;

    const modGroupB = await prisma.modifierGroup.create({
      data: {
        tenantId: TENANT_B,
        name: 'Salsas B',
        minSelections: 0,
        maxSelections: 2,
        isRequired: false,
        options: {
          create: [{ name: 'Ketchup B', priceDelta: 0.0, isDefault: true }],
        },
      },
    });
    modGroupBId = modGroupB.id;

    const prodB = await prisma.product.create({
      data: {
        tenantId: TENANT_B,
        categoryId: catBId,
        name: 'Pizza B',
        price: 25.0,
        isAvailable: true,
        sortOrder: 1,
      },
    });
    prodBId = prodB.id;

    // App backed by real database
    app = await createCatalogApp({
      categoryRepo: new PrismaCategoryRepository(prisma),
      productRepo: new PrismaProductRepository(prisma),
      modifierGroupRepo: new PrismaModifierGroupRepository(prisma),
    });
    adminTokenA = signTestJwt({ tenantId: TENANT_A, role: 'ADMIN' });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        // Clean up both tenants in dependency order
        await prisma.productModifierGroup.deleteMany({
          where: {
            OR: [
              { product: { tenantId: TENANT_A } },
              { product: { tenantId: TENANT_B } },
              { group: { tenantId: TENANT_A } },
              { group: { tenantId: TENANT_B } },
            ],
          },
        });
        await prisma.modifierOption.deleteMany({
          where: {
            OR: [
              { group: { tenantId: TENANT_A } },
              { group: { tenantId: TENANT_B } },
            ],
          },
        });
        await prisma.modifierGroup.deleteMany({
          where: { tenantId: { in: [TENANT_A, TENANT_B] } },
        });
        await prisma.product.deleteMany({
          where: { tenantId: { in: [TENANT_A, TENANT_B] } },
        });
        await prisma.category.deleteMany({
          where: { tenantId: { in: [TENANT_A, TENANT_B] } },
        });
        await prisma.$disconnect();
      }
    } catch (e) {
      console.error('Error during test cleanup:', e);
    }
  });

  describe('Cross-tenant attack vector 1: setAvailability', () => {
    it('rejects Tenant A attempting to change availability of Tenant B product with NOT_FOUND and leaves DB intact', async () => {
      const mutation = `
        mutation {
          setProductAvailability(id: "${prodBId}", isAvailable: false) {
            id
            isAvailable
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      // Verify PostgreSQL database was NOT modified
      const productBInDb = await prisma.product.findUnique({
        where: { id: prodBId },
      });
      expect(productBInDb).not.toBeNull();
      expect(productBInDb?.isAvailable).toBe(true);
      expect(productBInDb?.tenantId).toBe(TENANT_B);
    });
  });

  describe('Cross-tenant attack vector 2: updateProduct with category of Tenant B', () => {
    it('rejects Tenant A assigning Tenant B category to Product A with NOT_FOUND and leaves DB intact', async () => {
      const mutation = `
        mutation {
          updateProduct(id: "${prodAId}", input: { categoryId: "${catBId}" }) {
            id
            category {
              id
            }
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      // Verify PostgreSQL database was NOT modified
      const productAInDb = await prisma.product.findUnique({
        where: { id: prodAId },
      });
      expect(productAInDb?.categoryId).toBe(catAId);
    });

    it('rejects Tenant A assigning nonexistent category to Product A with NOT_FOUND and leaves DB intact', async () => {
      const mutation = `
        mutation {
          updateProduct(id: "${prodAId}", input: { categoryId: "nonexistent-category-uuid" }) {
            id
            category {
              id
            }
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      const productAInDb = await prisma.product.findUnique({
        where: { id: prodAId },
      });
      expect(productAInDb?.categoryId).toBe(catAId);
    });
  });

  describe('Cross-tenant attack vector 3: attachModifierGroup', () => {
    it('rejects Tenant A associating Tenant B modifier group to Product A with NOT_FOUND and leaves DB intact', async () => {
      const mutation = `
        mutation {
          attachModifierGroup(productId: "${prodAId}", groupId: "${modGroupBId}") {
            id
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      // Verify PostgreSQL database was NOT modified
      const crossRelation = await prisma.productModifierGroup.findUnique({
        where: {
          productId_groupId: {
            productId: prodAId,
            groupId: modGroupBId,
          },
        },
      });
      expect(crossRelation).toBeNull();
    });

    it('rejects Tenant A attempting to attach modifier group to Tenant B product with NOT_FOUND and leaves DB intact', async () => {
      const mutation = `
        mutation {
          attachModifierGroup(productId: "${prodBId}", groupId: "${modGroupAId}") {
            id
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      const crossRelation = await prisma.productModifierGroup.findUnique({
        where: {
          productId_groupId: {
            productId: prodBId,
            groupId: modGroupAId,
          },
        },
      });
      expect(crossRelation).toBeNull();
    });
  });

  describe('Cross-tenant attack vector 4: createProduct with category of Tenant B', () => {
    it('rejects Tenant A creating product with Tenant B category with NOT_FOUND and does not write to DB', async () => {
      const mutation = `
        mutation {
          createProduct(input: {
            categoryId: "${catBId}"
            name: "Hamburguesa Ilegitima"
            price: 15.0
          }) {
            id
            name
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]?.extensions?.code).toBe('NOT_FOUND');

      // Verify no product was created with that name
      const prodInDb = await prisma.product.findFirst({
        where: { name: 'Hamburguesa Ilegitima' },
      });
      expect(prodInDb).toBeNull();
    });
  });

  describe('Positive cases within the same tenant', () => {
    it('allows Tenant A to update availability of Product A successfully and updates DB', async () => {
      const mutation = `
        mutation {
          setProductAvailability(id: "${prodAId}", isAvailable: false) {
            id
            isAvailable
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data?.setProductAvailability?.isAvailable).toBe(false);

      const prodInDb = await prisma.product.findUnique({ where: { id: prodAId } });
      expect(prodInDb?.isAvailable).toBe(false);
    });

    it('allows Tenant A to update Product A category to Category A2 successfully and updates DB', async () => {
      const mutation = `
        mutation {
          updateProduct(id: "${prodAId}", input: { categoryId: "${catA2Id}" }) {
            id
            category {
              id
            }
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data?.updateProduct?.category?.id).toBe(catA2Id);

      const prodInDb = await prisma.product.findUnique({ where: { id: prodAId } });
      expect(prodInDb?.categoryId).toBe(catA2Id);
    });

    it('allows Tenant A to attach Modifier Group A to Product A and is idempotent', async () => {
      const mutation = `
        mutation {
          attachModifierGroup(productId: "${prodAId}", groupId: "${modGroupAId}") {
            id
          }
        }
      `;

      // First attach
      const res1 = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res1.body.errors).toBeUndefined();
      expect(res1.body.data?.attachModifierGroup?.id).toBe(prodAId);

      const relation1 = await prisma.productModifierGroup.findUnique({
        where: {
          productId_groupId: {
            productId: prodAId,
            groupId: modGroupAId,
          },
        },
      });
      expect(relation1).not.toBeNull();

      // Second attach (idempotent)
      const res2 = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ query: mutation });

      expect(res2.body.errors).toBeUndefined();
      expect(res2.body.data?.attachModifierGroup?.id).toBe(prodAId);
    });
  });
});
