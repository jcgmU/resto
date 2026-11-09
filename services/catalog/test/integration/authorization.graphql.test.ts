import request from 'supertest';
import fs from 'fs';
import path from 'path';
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

describe('Catalog Authorization & Query Limitation (U2)', () => {
  let app: any;
  let categoryRepo: InMemoryCategoryRepository;
  let productRepo: InMemoryProductRepository;
  let modifierGroupRepo: InMemoryModifierGroupRepository;

  beforeEach(async () => {
    categoryRepo = new InMemoryCategoryRepository();
    productRepo = new InMemoryProductRepository();
    modifierGroupRepo = new InMemoryModifierGroupRepository();

    app = await createCatalogApp({
      categoryRepo,
      productRepo,
      modifierGroupRepo,
    });
  });

  const TENANT = 'tenant-100';

  describe('U2-R7: Docker Compose Port Hardening', () => {
    it('docker-compose.yml does not expose or publish port 4002 to the host for catalog', () => {
      const composePath = path.resolve(__dirname, '../../../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      // Parse catalog service block
      const catalogSectionMatch = composeContent.match(/catalog:\s*\n([\s\S]*?)(?=\n\s{2}[a-zA-Z0-9_-]+:|$)/);
      expect(catalogSectionMatch).not.toBeNull();
      const catalogBlock = catalogSectionMatch![1];

      // Must not publish host port 4002
      expect(catalogBlock).not.toMatch(/ports:\s*\n\s*-\s*["']?4002:4002["']?/);
      expect(catalogBlock).not.toMatch(/ports:\s*\n\s*-\s*["']?\d+:4002["']?/);
    });
  });

  describe('U2-R7: Strict JWT Fail-Closed Verification & Unverified Header Rejection', () => {
    it('rejects raw x-user-role: ADMIN without valid JWT with FORBIDDEN and performs no writes', async () => {
      const query = `
        mutation {
          createCategory(input: { name: "Raw Header Hack" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT)
        .set('x-user-role', 'ADMIN')
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      const found = categoryRepo.categories.find((c) => c.name === 'Raw Header Hack');
      expect(found).toBeUndefined();
    });

    it('rejects raw x-user-role: MANAGER without valid JWT with FORBIDDEN and performs no writes', async () => {
      const query = `
        mutation {
          createCategory(input: { name: "Raw Manager Hack" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('x-tenant-id', TENANT)
        .set('x-user-role', 'MANAGER')
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      const found = categoryRepo.categories.find((c) => c.name === 'Raw Manager Hack');
      expect(found).toBeUndefined();
    });

    it('rejects expired JWT token with exp in the past and performs no writes', async () => {
      const expiredToken = signTestJwt({
        tenantId: TENANT,
        userId: 'admin-1',
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) - 3600,
      });

      const query = `
        mutation {
          createCategory(input: { name: "Expired Token Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);
      const found = categoryRepo.categories.find((c) => c.name === 'Expired Token Cat');
      expect(found).toBeUndefined();
    });

    it('rejects JWT with invalid signature and performs no writes', async () => {
      const invalidToken = signTestJwt(
        {
          tenantId: TENANT,
          userId: 'admin-1',
          role: 'ADMIN',
        },
        'wrong-secret-key-12345'
      );

      const query = `
        mutation {
          createCategory(input: { name: "Invalid Sig Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);
      const found = categoryRepo.categories.find((c) => c.name === 'Invalid Sig Cat');
      expect(found).toBeUndefined();
    });

    it('rejects when JWT_SECRET is unset/empty (fail-closed)', async () => {
      const origSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        const token = signTestJwt(
          {
            tenantId: TENANT,
            userId: 'admin-1',
            role: 'ADMIN',
          },
          'super-secret-jwt-key-hardening-test'
        );

        const query = `
          mutation {
            createCategory(input: { name: "No Secret Cat" }) {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${token}`)
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);
        const found = categoryRepo.categories.find((c) => c.name === 'No Secret Cat');
        expect(found).toBeUndefined();
      } finally {
        process.env.JWT_SECRET = origSecret;
      }
    });

    it('rejects JWT with alg: "none" (insecure algorithm)', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          tenantId: TENANT,
          userId: 'admin-1',
          role: 'ADMIN',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const query = `
        mutation {
          createCategory(input: { name: "None Alg Cat" }) {
            id
            name
          }
        }
      `;
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${noneToken}`)
        .send({ query });

      expect(res.body.errors).toBeDefined();
      expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(res.body.errors[0].extensions?.code);
      const found = categoryRepo.categories.find((c) => c.name === 'None Alg Cat');
      expect(found).toBeUndefined();
    });
  });

  describe('Mutations: Require ADMIN or MANAGER', () => {
    const forbiddenRoles = ['guest', 'GUEST', 'staff', 'STAFF', 'customer', 'CUSTOMER', 'UNKNOWN', ''];

    describe('createCategory', () => {
      forbiddenRoles.forEach((role) => {
        it(`rejects role "${role}" with FORBIDDEN and performs no writes`, async () => {
          const query = `
            mutation {
              createCategory(input: { name: "Unauthorized Cat" }) {
                id
                name
              }
            }
          `;
          const req = request(app).post('/graphql').set('x-tenant-id', TENANT);
          if (role !== '') {
            req.set('x-user-role', role);
          }
          const res = await req.send({ query });

          expect(res.body.errors).toBeDefined();
          expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
          const found = categoryRepo.categories.find((c) => c.name === 'Unauthorized Cat');
          expect(found).toBeUndefined();
        });
      });

      it('rejects when x-user-role header is omitted entirely', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "No Role Cat" }) {
              id
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects spoofed x-role header (x-role: ADMIN) with FORBIDDEN and performs no writes', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "Spoofed x-role Cat" }) {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-role', 'ADMIN')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
        const found = categoryRepo.categories.find((c) => c.name === 'Spoofed x-role Cat');
        expect(found).toBeUndefined();
      });

      it('rejects guest session attempting privilege escalation via x-session-id and x-user-role: ADMIN', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "Guest Session Escalation Cat" }) {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-session-id', 's-guest-123')
          .set('x-user-role', 'ADMIN')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
        const found = categoryRepo.categories.find((c) => c.name === 'Guest Session Escalation Cat');
        expect(found).toBeUndefined();
      });

      it('rejects guest session attempting privilege escalation via x-session-id and x-role: ADMIN', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "Guest Session x-role Escalation Cat" }) {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-session-id', 's-guest-123')
          .set('x-role', 'ADMIN')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
        const found = categoryRepo.categories.find((c) => c.name === 'Guest Session x-role Escalation Cat');
        expect(found).toBeUndefined();
      });

      it('allows role "admin" (lowercase)', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "Admin Cat" }) {
              id
              name
            }
          }
        `;
        const token = signTestJwt({ tenantId: TENANT, role: 'admin' });
        const res = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${token}`)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.createCategory.name).toBe('Admin Cat');
      });

      it('allows role "ADMIN" (uppercase)', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "ADMIN Cat" }) {
              id
              name
            }
          }
        `;
        const token = signTestJwt({ tenantId: TENANT, role: 'ADMIN' });
        const res = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${token}`)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.createCategory.name).toBe('ADMIN Cat');
      });

      it('allows role "manager" (lowercase)', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "Manager Cat" }) {
              id
              name
            }
          }
        `;
        const token = signTestJwt({ tenantId: TENANT, role: 'manager' });
        const res = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${token}`)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.createCategory.name).toBe('Manager Cat');
      });

      it('allows role "MANAGER" (uppercase)', async () => {
        const query = `
          mutation {
            createCategory(input: { name: "MANAGER Cat" }) {
              id
              name
            }
          }
        `;
        const token = signTestJwt({ tenantId: TENANT, role: 'MANAGER' });
        const res = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${token}`)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.createCategory.name).toBe('MANAGER Cat');
      });
    });

    describe('All 14 mutations reject non-admin/manager roles', () => {
      const testCases: { name: string; query: string; checkNoWrite?: () => void }[] = [
        {
          name: 'updateCategory',
          query: `mutation { updateCategory(id: "cat-1", input: { name: "Hacked" }) { id name } }`,
          checkNoWrite: () => {
            const cat = categoryRepo.categories.find((c) => c.id === 'cat-1');
            expect(cat?.name).toBe('Entradas');
          },
        },
        {
          name: 'deleteCategory',
          query: `mutation { deleteCategory(id: "cat-1") }`,
          checkNoWrite: () => {
            const cat = categoryRepo.categories.find((c) => c.id === 'cat-1');
            expect(cat).toBeDefined();
          },
        },
        {
          name: 'createProduct',
          query: `mutation { createProduct(input: { categoryId: "cat-1", name: "Hacked Burger", price: 9.99 }) { id } }`,
          checkNoWrite: () => {
            const prod = productRepo.products.find((p) => p.name === 'Hacked Burger');
            expect(prod).toBeUndefined();
          },
        },
        {
          name: 'updateProduct',
          query: `mutation { updateProduct(id: "prod-1", input: { name: "Hacked Burger" }) { id name } }`,
          checkNoWrite: () => {
            const prod = productRepo.products.find((p) => p.id === 'prod-1');
            expect(prod?.name).toBe('Hamburguesa Clásica');
          },
        },
        {
          name: 'deleteProduct',
          query: `mutation { deleteProduct(id: "prod-1") }`,
          checkNoWrite: () => {
            const prod = productRepo.products.find((p) => p.id === 'prod-1');
            expect(prod).toBeDefined();
          },
        },
        {
          name: 'setProductAvailability',
          query: `mutation { setProductAvailability(id: "prod-1", isAvailable: false) { id isAvailable } }`,
          checkNoWrite: () => {
            const prod = productRepo.products.find((p) => p.id === 'prod-1');
            expect(prod?.isAvailable).toBe(true);
          },
        },
        {
          name: 'createModifierGroup',
          query: `mutation { createModifierGroup(input: { name: "Hacked Group" }) { id } }`,
          checkNoWrite: () => {
            const grp = modifierGroupRepo.groups.find((g) => g.name === 'Hacked Group');
            expect(grp).toBeUndefined();
          },
        },
        {
          name: 'updateModifierGroup',
          query: `mutation { updateModifierGroup(id: "group-1", input: { name: "Hacked Group" }) { id } }`,
          checkNoWrite: () => {
            const grp = modifierGroupRepo.groups.find((g) => g.id === 'group-1');
            expect(grp?.name).toBe('Extras');
          },
        },
        {
          name: 'deleteModifierGroup',
          query: `mutation { deleteModifierGroup(id: "group-1") }`,
          checkNoWrite: () => {
            const grp = modifierGroupRepo.groups.find((g) => g.id === 'group-1');
            expect(grp).toBeDefined();
          },
        },
        {
          name: 'addModifierOption',
          query: `mutation { addModifierOption(groupId: "group-1", input: { name: "Hacked Option", priceDelta: 1 }) { id } }`,
          checkNoWrite: () => {
            const grp = modifierGroupRepo.groups.find((g) => g.id === 'group-1');
            const opt = grp?.options.find((o) => o.name === 'Hacked Option');
            expect(opt).toBeUndefined();
          },
        },
        {
          name: 'removeModifierOption',
          query: `mutation { removeModifierOption(id: "opt-1") }`,
          checkNoWrite: () => {
            const grp = modifierGroupRepo.groups.find((g) => g.id === 'group-1');
            const opt = grp?.options.find((o) => o.id === 'opt-1');
            expect(opt).toBeDefined();
          },
        },
        {
          name: 'attachModifierGroup',
          query: `mutation { attachModifierGroup(productId: "prod-1", groupId: "group-1") { id } }`,
          checkNoWrite: () => {
            expect(productRepo.productModifiers.length).toBe(0);
          },
        },
        {
          name: 'detachModifierGroup',
          query: `mutation { detachModifierGroup(productId: "prod-1", groupId: "group-1") { id } }`,
        },
      ];

      testCases.forEach(({ name, query, checkNoWrite }) => {
        it(`rejects mutation "${name}" for guest with FORBIDDEN`, async () => {
          const res = await request(app)
            .post('/graphql')
            .set('x-tenant-id', TENANT)
            .set('x-user-role', 'guest')
            .send({ query });

          expect(res.body.errors).toBeDefined();
          expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
          if (checkNoWrite) checkNoWrite();
        });

        it(`rejects mutation "${name}" for staff with FORBIDDEN`, async () => {
          const res = await request(app)
            .post('/graphql')
            .set('x-tenant-id', TENANT)
            .set('x-user-role', 'staff')
            .send({ query });

          expect(res.body.errors).toBeDefined();
          expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
          if (checkNoWrite) checkNoWrite();
        });

        it(`rejects mutation "${name}" for raw unverified x-user-role: ADMIN with FORBIDDEN`, async () => {
          const res = await request(app)
            .post('/graphql')
            .set('x-tenant-id', TENANT)
            .set('x-user-role', 'ADMIN')
            .send({ query });

          expect(res.body.errors).toBeDefined();
          expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
          if (checkNoWrite) checkNoWrite();
        });
      });
    });

    describe('Operations with aliases, fragments and named mutations', () => {
      it('rejects aliased mutation for guest', async () => {
        const query = `
          mutation AliasedOp {
            aliasCreate: createCategory(input: { name: "Aliased" }) {
              id
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects mutation with fragment for guest', async () => {
        const query = `
          mutation WithFrag {
            ...FragMutation
          }
          fragment FragMutation on Mutation {
            createCategory(input: { name: "FromFrag" }) {
              id
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });
    });
  });

  describe('Queries: Limitations for Guest', () => {
    describe('Allowed queries for guest', () => {
      it('guest can query root "categories" and nested products/modifierGroups/options', async () => {
        const query = `
          query GetMenuCategories {
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
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.categories).toBeDefined();
        expect(Array.isArray(res.body.data.categories)).toBe(true);
        expect(res.body.data.categories.length).toBeGreaterThan(0);
      });

      it('guest can query root "products" and nested category/modifierGroups/options', async () => {
        const query = `
          query GetMenuProducts {
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
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.products).toBeDefined();
        expect(Array.isArray(res.body.data.products)).toBe(true);
        expect(res.body.data.products[0].category).toBeDefined();
        expect(res.body.data.products[0].modifierGroups).toBeDefined();
      });
    });

    describe('Forbidden queries for guest', () => {
      it('rejects root "category" query for guest with FORBIDDEN', async () => {
        const query = `
          query {
            category(id: "cat-1") {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects root "product" query for guest with FORBIDDEN', async () => {
        const query = `
          query {
            product(id: "prod-1") {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects root "modifierGroups" query for guest with FORBIDDEN', async () => {
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
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects aliased root "product" query for guest with FORBIDDEN', async () => {
        const query = `
          query AliasedProduct {
            p: product(id: "prod-1") {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });

      it('rejects fragment root "category" query for guest with FORBIDDEN', async () => {
        const query = `
          query {
            ...CatFrag
          }
          fragment CatFrag on Query {
            category(id: "cat-1") {
              id
              name
            }
          }
        `;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'guest')
          .send({ query });

        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].extensions?.code).toBe('FORBIDDEN');
      });
    });

    describe('Staff and Admin access to queries', () => {
      it('allows staff to query root "category"', async () => {
        const query = `query { category(id: "cat-1") { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'staff')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.category.id).toBe('cat-1');
      });

      it('allows staff to query root "product"', async () => {
        const query = `query { product(id: "prod-1") { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'staff')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.product.id).toBe('prod-1');
      });

      it('allows staff to query root "modifierGroups"', async () => {
        const query = `query { modifierGroups { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'staff')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.modifierGroups.length).toBeGreaterThan(0);
      });

      it('allows admin to query root "product"', async () => {
        const query = `query { product(id: "prod-1") { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .set('x-user-role', 'admin')
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.product.id).toBe('prod-1');
      });
    });

    describe('Internal service calls (GraphqlCatalogValidationAdapter compatibility)', () => {
      it('allows query root "product" when x-user-role is omitted (internal service call)', async () => {
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
          .set('x-tenant-id', TENANT)
          .send({ query, variables: { id: 'prod-1' } });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.product).toBeDefined();
        expect(res.body.data.product.id).toBe('prod-1');
      });

      it('allows query root "category" when x-user-role is omitted', async () => {
        const query = `query { category(id: "cat-1") { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.category.id).toBe('cat-1');
      });

      it('allows query root "modifierGroups" when x-user-role is omitted', async () => {
        const query = `query { modifierGroups { id name } }`;
        const res = await request(app)
          .post('/graphql')
          .set('x-tenant-id', TENANT)
          .send({ query });

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.modifierGroups.length).toBeGreaterThan(0);
      });
    });
  });
});
