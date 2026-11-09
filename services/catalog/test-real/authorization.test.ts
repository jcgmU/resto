import request from 'supertest';
import http from 'http';
import { PrismaClient } from '../src/generated/client';
import { createCatalogApp } from '../src/app';
import { PrismaCategoryRepository } from '../src/infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from '../src/infrastructure/persistence/PrismaProductRepository';
import { PrismaModifierGroupRepository } from '../src/infrastructure/persistence/PrismaModifierGroupRepository';
import { createApp as createGatewayApp } from '../../gateway/src/app';
import { config as gatewayConfig } from '../../gateway/src/config';
const jwt = require('../../gateway/node_modules/jsonwebtoken');

describe('Catalog Real Authorization & Query Limitation (U2)', () => {
  let app: any;
  let catalogServer: http.Server;
  let gatewayApp: any;
  let originalCatalogUrl: string;
  let prisma: PrismaClient;
  const TENANT_REAL = `tenant-auth-real-${Date.now()}`;
  let seededCategoryId: string;
  let seededProductId: string;
  let seededModifierGroupId: string;

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

    // Seed test category, product, and modifier group in real PostgreSQL
    const cat = await prisma.category.create({
      data: {
        tenantId: TENANT_REAL,
        name: 'Categoria Real U2',
        sortOrder: 1,
        isActive: true,
      },
    });
    seededCategoryId = cat.id;

    const modGroup = await prisma.modifierGroup.create({
      data: {
        tenantId: TENANT_REAL,
        name: 'Salsas Real U2',
        minSelections: 0,
        maxSelections: 2,
        isRequired: false,
        options: {
          create: [
            { name: 'Salsa Picante', priceDelta: 0.5, isDefault: false },
            { name: 'Salsa Barbacoa', priceDelta: 0.0, isDefault: true },
          ],
        },
      },
      include: { options: true },
    });
    seededModifierGroupId = modGroup.id;

    const prod = await prisma.product.create({
      data: {
        tenantId: TENANT_REAL,
        categoryId: seededCategoryId,
        name: 'Plato Real U2',
        description: 'Plato para prueba de autorizacion real',
        price: 15.5,
        isAvailable: true,
        sortOrder: 1,
        modifierGroups: {
          create: [{ groupId: seededModifierGroupId }],
        },
      },
    });
    seededProductId = prod.id;

    // App backed by real database with Prisma repositories
    app = await createCatalogApp({
      categoryRepo: new PrismaCategoryRepository(prisma),
      productRepo: new PrismaProductRepository(prisma),
      modifierGroupRepo: new PrismaModifierGroupRepository(prisma),
    });

    // Start ephemeral catalog HTTP server and bind gateway app to it
    catalogServer = http.createServer(app);
    await new Promise<void>((resolve) => catalogServer.listen(0, resolve));
    const catalogPort = (catalogServer.address() as any).port;
    const catalogUrl = `http://127.0.0.1:${catalogPort}`;

    originalCatalogUrl = gatewayConfig.services.catalog;
    gatewayConfig.services.catalog = catalogUrl;
    gatewayConfig.jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test';
    gatewayApp = createGatewayApp();
  });

  afterAll(async () => {
    try {
      if (gatewayConfig && originalCatalogUrl) {
        gatewayConfig.services.catalog = originalCatalogUrl;
      }
      if (catalogServer) {
        await new Promise<void>((resolve) => catalogServer.close(() => resolve()));
      }
      if (prisma) {
        await prisma.productModifierGroup.deleteMany({
          where: { product: { tenantId: TENANT_REAL } },
        });
        await prisma.modifierOption.deleteMany({
          where: { group: { tenantId: TENANT_REAL } },
        });
        await prisma.modifierGroup.deleteMany({
          where: { tenantId: TENANT_REAL },
        });
        await prisma.product.deleteMany({
          where: { tenantId: TENANT_REAL },
        });
        await prisma.category.deleteMany({
          where: { tenantId: TENANT_REAL },
        });
        await prisma.$disconnect();
      }
    } catch {
      // ignore cleanup errors
    }
  });

  describe('Real Database: Mutation authorization', () => {
    it('rejects guest attempting createCategory on real database with FORBIDDEN and does not write', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Guest Hack Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      // Verify no record was inserted into real PostgreSQL
      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Guest Hack Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('rejects staff attempting updateProduct on real database with FORBIDDEN and does not write', async () => {
      const mutation = `
        mutation {
          updateProduct(id: "${seededProductId}", input: { name: "Staff Hack Prod" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'staff')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      const inDb = await prisma.product.findUnique({
        where: { id: seededProductId },
      });
      expect(inDb?.name).toBe('Plato Real U2');
    });

    it('rejects direct request to Catalog attempting createCategory with raw x-user-role: ADMIN without valid JWT and does not write to Postgres', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Direct Raw Header Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'ADMIN')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Direct Raw Header Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('rejects request with expired JWT on real database and does not write to Postgres', async () => {
      const expiredToken = jwt.sign(
        { userId: 'admin-real-1', role: 'ADMIN', tenantId: TENANT_REAL, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test'
      );
      const mutation = `
        mutation {
          createCategory(input: { name: "Expired JWT Real Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Expired JWT Real Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('rejects request with invalid signature JWT on real database and does not write to Postgres', async () => {
      const invalidToken = jwt.sign(
        { userId: 'admin-real-1', role: 'ADMIN', tenantId: TENANT_REAL, exp: Math.floor(Date.now() / 1000) + 3600 },
        'wrong-secret-key-real-db'
      );
      const mutation = `
        mutation {
          createCategory(input: { name: "Invalid Sig Real Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Invalid Sig Real Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('allows ADMIN with valid JWT to createCategory on real database', async () => {
      const adminToken = jwt.sign(
        { userId: 'admin-real-1', role: 'ADMIN', tenantId: TENANT_REAL, exp: Math.floor(Date.now() / 1000) + 3600 },
        process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test'
      );
      const mutation = `
        mutation {
          createCategory(input: { name: "Admin Created Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ query: mutation });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.createCategory.name).toBe('Admin Created Cat');

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Admin Created Cat' },
      });
      expect(inDb).not.toBeNull();
    });

    it('rejects guest attempting createCategory through Gateway with spoofed x-role: ADMIN with FORBIDDEN and does not write to Postgres', async () => {
      const guestToken = jwt.sign(
        { sessionId: `sess-spoof-1-${Date.now()}`, tableId: 't-real-1', tenantId: TENANT_REAL },
        process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test',
        { expiresIn: 3600 }
      );

      const mutation = `
        mutation {
          createCategory(input: { name: "Spoofed Via Gateway Cat" }) {
            id
            name
          }
        }
      `;

      const res = await request(gatewayApp)
        .post('/v1/graphql')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('x-role', 'ADMIN')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Spoofed Via Gateway Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('rejects guest attempting createCategory through Gateway with spoofed x-user-role: ADMIN with FORBIDDEN and does not write to Postgres', async () => {
      const guestToken = jwt.sign(
        { sessionId: `sess-spoof-2-${Date.now()}`, tableId: 't-real-1', tenantId: TENANT_REAL },
        process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test',
        { expiresIn: 3600 }
      );

      const mutation = `
        mutation {
          createCategory(input: { name: "Spoofed UserRole Via Gateway Cat" }) {
            id
            name
          }
        }
      `;

      const res = await request(gatewayApp)
        .post('/v1/graphql')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('x-user-role', 'ADMIN')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Spoofed UserRole Via Gateway Cat' },
      });
      expect(inDb).toBeNull();
    });

    it('rejects direct request to Catalog attempting createCategory with x-role: ADMIN without x-user-role and does not write to Postgres', async () => {
      const mutation = `
        mutation {
          createCategory(input: { name: "Direct Catalog x-role Spoof Cat" }) {
            id
            name
          }
        }
      `;

      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-role', 'ADMIN')
        .send({ query: mutation });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');

      const inDb = await prisma.category.findFirst({
        where: { tenantId: TENANT_REAL, name: 'Direct Catalog x-role Spoof Cat' },
      });
      expect(inDb).toBeNull();
    });
  });

  describe('Real Database: Query limitations for guest', () => {
    it('allows guest to query root "categories" with nested products and modifierGroups', async () => {
      const query = `
        query {
          categories {
            id
            name
            products {
              id
              name
              price
              modifierGroups {
                id
                name
                options {
                  id
                  name
                  priceDelta
                }
              }
            }
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.categories).toBeDefined();
      const cat = res.body.data.categories.find((c: any) => c.id === seededCategoryId);
      expect(cat).toBeDefined();
      expect(cat.products.length).toBeGreaterThan(0);
      expect(cat.products[0].modifierGroups.length).toBeGreaterThan(0);
    });

    it('allows guest to query root "products" with nested category and modifierGroups', async () => {
      const query = `
        query {
          products {
            id
            name
            price
            category {
              id
              name
            }
            modifierGroups {
              id
              name
              options {
                id
                name
                priceDelta
              }
            }
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.products).toBeDefined();
      const prod = res.body.data.products.find((p: any) => p.id === seededProductId);
      expect(prod).toBeDefined();
      expect(prod.category.name).toBe('Categoria Real U2');
    });

    it('rejects guest querying root "product" directly with FORBIDDEN', async () => {
      const query = `
        query {
          product(id: "${seededProductId}") {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
    });

    it('rejects guest querying root "category" directly with FORBIDDEN', async () => {
      const query = `
        query {
          category(id: "${seededCategoryId}") {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
    });

    it('rejects guest querying root "modifierGroups" directly with FORBIDDEN', async () => {
      const query = `
        query {
          modifierGroups {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .set('x-user-role', 'guest')
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
    });

    it('allows internal service call without role (GraphqlCatalogValidationAdapter) to query root "product"', async () => {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
            price
            isAvailable
            modifierGroups {
              id
              name
              options {
                id
                name
                priceDelta
              }
            }
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT_REAL)
        .send({ query, variables: { id: seededProductId } });

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.product).toBeDefined();
      expect(res.body.data.product.id).toBe(seededProductId);
      expect(res.body.data.product.price).toBe(15.5);
    });
  });
});
