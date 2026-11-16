const supertestPath = require.resolve('supertest', { paths: [__dirname + '/../services/identity'] });
const request = require(supertestPath);
const { createIdentityApp } = require('../services/identity/dist/app');
const { createCatalogApp } = require('../services/catalog/dist/app');

async function run() {
  const idApp = createIdentityApp();
  const catApp = await createCatalogApp();

  const suffix = Date.now();
  const email = `e2e-${suffix}@resto.com`;
  const internalToken = process.env.INTERNAL_SHARED_SECRET || '';

  // 1. Register
  const regReq = request(idApp).post('/auth/register');
  if (internalToken) regReq.set('x-internal-token', internalToken);
  const reg = await regReq.send({
    restaurantName: `E2E Resto ${suffix}`,
    adminEmail: email,
    adminPassword: 'password123',
    adminDisplayName: 'E2E Admin'
  });
  console.log('1. Register status:', reg.status, 'tenantId:', reg.body.tenant?.id);

  // 2. Login
  const loginReq = request(idApp).post('/auth/login');
  if (internalToken) loginReq.set('x-internal-token', internalToken);
  const login = await loginReq.send({
    email,
    password: 'password123'
  });
  console.log('2. Login status:', login.status, 'hasToken:', !!login.body.tokens?.accessToken);

  const tenantId = reg.body.tenant.id;
  const accessToken = login.body.tokens.accessToken;

  // 3. Create category via GraphQL
  const mutReq = request(catApp)
    .post('/graphql')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`);
  if (internalToken) mutReq.set('x-internal-token', internalToken);
  const mut = await mutReq.send({
    query: 'mutation { createCategory(input: { name: "Postres" }) { id name } }'
  });
  console.log('3. Mutation status:', mut.status, 'data:', mut.body.data);

  // 4. Query categories
  const queryReq = request(catApp)
    .post('/graphql')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`);
  if (internalToken) queryReq.set('x-internal-token', internalToken);
  const query = await queryReq.send({
    query: 'query { categories { id name } }'
  });
  console.log('4. Query status:', query.status, 'categories count:', query.body.data?.categories?.length);

  const found = query.body.data?.categories?.some(c => c.name === 'Postres');
  console.log('E2E FLOW CHECK 47 RESULT:', found ? 'SUCCESS' : 'FAILED');
  if (!found) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
