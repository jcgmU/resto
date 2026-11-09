#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const projectName = `resto-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const composeFile = path.resolve(ROOT_DIR, 'infra/test/docker-compose.yml');

// Command line options
const args = process.argv.slice(2);
const skipServices = args.includes('--skip-services');
const keepAlive = args.includes('--keep-alive');
const onlyInfra = args.includes('--only-infra');

function log(msg) {
  console.log(`[harness] ${msg}`);
}

function error(msg) {
  console.error(`[harness:error] ${msg}`);
}

function exec(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT_DIR,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 300000,
    ...opts,
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

export async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastReason = 'no response';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        if (body && body.status === 'ok') {
          return true;
        }
        lastReason = `HTTP 200 with invalid body ${JSON.stringify(body)}`;
      } else {
        lastReason = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastReason = err?.message || 'connection refused';
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for healthy ${url} after ${timeoutMs}ms (last: ${lastReason})`);
}

export function createHarnessController({
  rootDir = ROOT_DIR,
  projectName: ctrlProjectName = `resto-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  composeFile: ctrlComposeFile = path.resolve(rootDir, 'infra/test/docker-compose.yml'),
  keepAlive: ctrlKeepAlive = false,
  execFn = (cmd, opts = {}) =>
    execSync(cmd, {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 300000,
      ...opts,
    }),
} = {}) {
  if (typeof ctrlProjectName !== 'string' || !ctrlProjectName.startsWith('resto-test-')) {
    throw new Error(
      `Invalid harness projectName "${ctrlProjectName}": must start with "resto-test-"`
    );
  }

  const identitySrcGen = path.resolve(rootDir, 'services/identity/src/generated');
  const identityDistGen = path.resolve(rootDir, 'services/identity/dist/generated');
  const catalogSrcGen = path.resolve(rootDir, 'services/catalog/src/generated');
  const catalogDistGen = path.resolve(rootDir, 'services/catalog/dist/generated');

  let activeProcesses = [];
  let infraAttempted = false;
  let createdIdentityDistGenerated = false;
  let createdCatalogDistGenerated = false;
  let cleanedUp = false;

  function startInfra() {
    infraAttempted = true;
    execFn(`docker compose -p ${ctrlProjectName} -f "${ctrlComposeFile}" up -d --wait`);
  }

  function prepareDistGenerated() {
    if (!fs.existsSync(identityDistGen)) {
      fs.cpSync(identitySrcGen, identityDistGen, {
        recursive: true,
      });
      createdIdentityDistGenerated = true;
    }
    if (!fs.existsSync(catalogDistGen)) {
      fs.cpSync(catalogSrcGen, catalogDistGen, {
        recursive: true,
      });
      createdCatalogDistGenerated = true;
    }
  }

  function registerProcess(proc) {
    activeProcesses.push(proc);
  }

  async function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    log('Cleaning up test harness resources...');

    for (const proc of activeProcesses) {
      try {
        if (proc && !proc.killed && proc.pid) {
          process.kill(-proc.pid, 'SIGTERM');
        }
      } catch (_) {
        try {
          process.kill(proc.pid, 'SIGKILL');
        } catch (_) {}
      }
    }
    activeProcesses = [];

    if (createdIdentityDistGenerated) {
      try {
        fs.rmSync(identityDistGen, { recursive: true, force: true });
      } catch (_) {}
      createdIdentityDistGenerated = false;
    }
    if (createdCatalogDistGenerated) {
      try {
        fs.rmSync(catalogDistGen, { recursive: true, force: true });
      } catch (_) {}
      createdCatalogDistGenerated = false;
    }

    if (infraAttempted && !ctrlKeepAlive) {
      try {
        execFn(`docker compose -p ${ctrlProjectName} -f "${ctrlComposeFile}" down -v`);
        log(`Docker compose project ${ctrlProjectName} stopped and removed.`);
      } catch (err) {
        error(`Error tearing down docker-compose: ${err.message}`);
      }
    }
  }

  return {
    rootDir,
    projectName: ctrlProjectName,
    composeFile: ctrlComposeFile,
    startInfra,
    prepareDistGenerated,
    registerProcess,
    cleanup,
  };
}

const defaultController = createHarnessController({
  rootDir: ROOT_DIR,
  projectName,
  composeFile,
  keepAlive,
  execFn: exec,
});

export async function cleanup() {
  await defaultController.cleanup();
}

// Trap signals for clean exit
process.on('SIGINT', async () => {
  log('Received SIGINT, aborting...');
  await cleanup();
  process.exit(130);
});
process.on('SIGTERM', async () => {
  log('Received SIGTERM, aborting...');
  await cleanup();
  process.exit(143);
});

export async function main() {
  try {
    log(`Starting isolated test harness with project name: ${projectName}`);

    // Step 1: docker compose up -d --wait
    defaultController.startInfra();
    log('Postgres and Redis containers healthy.');

    // Step 2: Discover ephemeral ports
    const pgPortRaw = exec(`docker compose -p ${projectName} -f "${composeFile}" port postgres 5432`).trim();
    const redisPortRaw = exec(`docker compose -p ${projectName} -f "${composeFile}" port redis 6379`).trim();

    const pgPortMatch = pgPortRaw.match(/:(\d+)$/);
    const redisPortMatch = redisPortRaw.match(/:(\d+)$/);

    if (!pgPortMatch || !redisPortMatch) {
      throw new Error(`Failed to discover ephemeral ports. Postgres: "${pgPortRaw}", Redis: "${redisPortRaw}"`);
    }

    const pgPort = parseInt(pgPortMatch[1], 10);
    const redisPort = parseInt(redisPortMatch[1], 10);

    const identityDbUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/identity_test?schema=public`;
    const catalogDbUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/catalog_test?schema=public`;
    const orderingDbUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/ordering_test?schema=public`;
    const sessionRedisUrl = `redis://127.0.0.1:${redisPort}/0`;
    const orderingRedisUrl = `redis://127.0.0.1:${redisPort}/1`;
    const jwtSecret = 'super-secret-jwt-key-hardening-test';

    log(`Discovered Ephemeral Ports: Postgres=${pgPort}, Redis=${redisPort}`);
    log(`Database URLs configured (credentials masked):`);
    log(`  - identity: postgresql://postgres:***@127.0.0.1:${pgPort}/identity_test`);
    log(`  - catalog:  postgresql://postgres:***@127.0.0.1:${pgPort}/catalog_test`);
    log(`  - ordering: postgresql://postgres:***@127.0.0.1:${pgPort}/ordering_test`);
    log(`  - session:  redis://127.0.0.1:${redisPort}/0`);
    log(`  - ordering: redis://127.0.0.1:${redisPort}/1`);

    // Step 3: Create isolated databases
    log('Creating isolated databases in Postgres...');
    for (const dbName of ['identity_test', 'catalog_test', 'ordering_test']) {
      exec(`docker compose -p ${projectName} -f "${composeFile}" exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE ${dbName};"`);
    }
    log('Isolated databases created: identity_test, catalog_test, ordering_test');

    // Step 4: Apply Prisma migrations
    log('Applying Prisma migrations (prisma migrate deploy)...');
    exec(`pnpm --filter @services/identity exec prisma migrate deploy`, {
      env: { ...process.env, IDENTITY_DATABASE_URL: identityDbUrl, DATABASE_URL: identityDbUrl },
    });
    exec(`pnpm --filter @services/catalog exec prisma migrate deploy`, {
      env: { ...process.env, CATALOG_DATABASE_URL: catalogDbUrl, DATABASE_URL: catalogDbUrl },
    });
    exec(`pnpm --filter @services/ordering exec prisma migrate deploy`, {
      env: { ...process.env, ORDERING_DATABASE_URL: orderingDbUrl, DATABASE_URL: orderingDbUrl },
    });
    log('Prisma migrations applied successfully.');

    // Step 5: Build shared packages
    log('Building shared packages (@packages/*)...');
    exec('pnpm --filter "@packages/*" run build');
    log('Shared packages built successfully.');

    // Step 6: Generate Prisma clients
    log('Generating Prisma clients...');
    exec('pnpm --filter @services/identity exec prisma generate');
    exec('pnpm --filter @services/catalog exec prisma generate');
    exec('pnpm --filter @services/ordering exec prisma generate');
    log('Prisma clients generated successfully.');

    if (onlyInfra) {
      log('Infra-only mode requested. Infrastructure is ready.');
      return;
    }

    // Step 7: Run test:real suites
    log('--- Running test:real suites ---');

    log('Testing @services/identity...');
    exec('pnpm --filter @services/identity run test:real', {
      env: {
        ...process.env,
        IDENTITY_DATABASE_URL: identityDbUrl,
        DATABASE_URL: identityDbUrl,
        JWT_SECRET: jwtSecret,
      },
      stdio: 'inherit',
    });

    log('Testing @services/catalog...');
    exec('pnpm --filter @services/catalog run test:real', {
      env: {
        ...process.env,
        CATALOG_DATABASE_URL: catalogDbUrl,
        DATABASE_URL: catalogDbUrl,
        JWT_SECRET: jwtSecret,
      },
      stdio: 'inherit',
    });

    log('Testing @services/session...');
    exec('pnpm --filter @services/session run test:real', {
      env: {
        ...process.env,
        REDIS_URL: sessionRedisUrl,
        JWT_SECRET: jwtSecret,
      },
      stdio: 'inherit',
    });

    log('Testing @services/ordering...');
    exec('pnpm --filter @services/ordering run test:real', {
      env: {
        ...process.env,
        ORDERING_DATABASE_URL: orderingDbUrl,
        DATABASE_URL: orderingDbUrl,
        REDIS_URL: orderingRedisUrl,
        JWT_SECRET: jwtSecret,
      },
      stdio: 'inherit',
    });

    log('Testing @services/gateway...');
    exec('pnpm --filter @services/gateway run test:real', {
      env: {
        ...process.env,
        JWT_SECRET: jwtSecret,
      },
      stdio: 'inherit',
    });

    log('All test:real unit/integration suites passed in green.');

    // Step 8: Start 5 HTTP services if not skipped
    if (!skipServices) {
      log('--- Building services & spawning 5 isolated HTTP services for gateway traversal ---');
      exec('pnpm --filter "./services/*" -r run build');
      defaultController.prepareDistGenerated();

      const identityPort = await getFreePort();
      const catalogPort = await getFreePort();
      const sessionPort = await getFreePort();
      const orderingPort = await getFreePort();
      const gatewayPort = await getFreePort();

      log(`Assigned Service Ports: identity=${identityPort}, catalog=${catalogPort}, session=${sessionPort}, ordering=${orderingPort}, gateway=${gatewayPort}`);

      const serviceDefs = [
        {
          name: 'identity',
          dir: 'services/identity',
          url: `http://127.0.0.1:${identityPort}/health`,
          env: {
            PORT: String(identityPort),
            IDENTITY_DATABASE_URL: identityDbUrl,
            DATABASE_URL: identityDbUrl,
            JWT_SECRET: jwtSecret,
            NODE_ENV: 'development',
          },
        },
        {
          name: 'catalog',
          dir: 'services/catalog',
          url: `http://127.0.0.1:${catalogPort}/health`,
          env: {
            PORT: String(catalogPort),
            CATALOG_DATABASE_URL: catalogDbUrl,
            DATABASE_URL: catalogDbUrl,
            JWT_SECRET: jwtSecret,
            NODE_ENV: 'development',
          },
        },
        {
          name: 'session',
          dir: 'services/session',
          url: `http://127.0.0.1:${sessionPort}/health`,
          env: {
            PORT: String(sessionPort),
            REDIS_URL: sessionRedisUrl,
            JWT_SECRET: jwtSecret,
            NODE_ENV: 'development',
          },
        },
        {
          name: 'ordering',
          dir: 'services/ordering',
          url: `http://127.0.0.1:${orderingPort}/health`,
          env: {
            PORT: String(orderingPort),
            ORDERING_PORT: String(orderingPort),
            ORDERING_DATABASE_URL: orderingDbUrl,
            DATABASE_URL: orderingDbUrl,
            REDIS_URL: orderingRedisUrl,
            CATALOG_INTERNAL_URL: `http://127.0.0.1:${catalogPort}/graphql`,
            SESSION_INTERNAL_URL: `http://127.0.0.1:${sessionPort}`,
            JWT_SECRET: jwtSecret,
            NODE_ENV: 'development',
          },
        },
        {
          name: 'gateway',
          dir: 'services/gateway',
          url: `http://127.0.0.1:${gatewayPort}/health`,
          env: {
            PORT: String(gatewayPort),
            GATEWAY_PORT: String(gatewayPort),
            IDENTITY_SERVICE_URL: `http://127.0.0.1:${identityPort}`,
            CATALOG_SERVICE_URL: `http://127.0.0.1:${catalogPort}`,
            SESSION_SERVICE_URL: `http://127.0.0.1:${sessionPort}`,
            ORDERING_SERVICE_URL: `http://127.0.0.1:${orderingPort}`,
            JWT_SECRET: jwtSecret,
            NODE_ENV: 'development',
          },
        },
      ];

      for (const svc of serviceDefs) {
        log(`Starting ${svc.name} service on port ${svc.env.PORT || svc.env.GATEWAY_PORT}...`);
        // Use pnpm exec ts-node src/index.ts if ts-node is installed locally in the workspace,
        // otherwise fall back cleanly to node dist/index.js (offline-safe, zero network downloads).
        const proc = spawn('sh', ['-c', 'pnpm exec ts-node src/index.ts 2>/dev/null || node dist/index.js'], {
          cwd: path.resolve(ROOT_DIR, svc.dir),
          env: { ...process.env, ...svc.env },
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        proc.stdout.on('data', (d) => {
          // un-comment if debugging service logs:
          // process.stdout.write(`[${svc.name}] ${d}`);
        });
        proc.stderr.on('data', (d) => {
          // un-comment if debugging service logs:
          // process.stderr.write(`[${svc.name}:err] ${d}`);
        });

        defaultController.registerProcess(proc);
      }

      // Wait for health of each service
      for (const svc of serviceDefs) {
        await waitForHttp(svc.url, 25000);
        log(`Service ${svc.name} is healthy at ${svc.url}`);
      }

      // Verify Gateway aggregation health check
      log('Verifying Gateway aggregation health endpoint...');
      const gwRes = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
      if (!gwRes.ok) {
        throw new Error(`Gateway health check failed with status ${gwRes.status}`);
      }
      const gwData = await gwRes.json();
      log(`Gateway responded with: ${JSON.stringify(gwData)}`);

      if (gwData.status !== 'ok') {
        throw new Error(`Gateway returned non-ok status: ${JSON.stringify(gwData)}`);
      }

      const gwBase = `http://127.0.0.1:${gatewayPort}`;

      async function gwRequest(method, pathUrl, { token, body } = {}) {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const res = await fetch(`${gwBase}${pathUrl}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try {
          data = await res.json();
        } catch (_) {}
        return { status: res.status, data };
      }

      async function gwGraphql(token, query, variables = {}) {
        return gwRequest('POST', '/v1/graphql', {
          token,
          body: { query, variables },
        });
      }

      // 1. Auth & Refresh (U6 / H8)
      log('[E2E 1/6] Testing Auth & Refresh rotation via Gateway...');
      const ts = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const adminEmailA = `admin-a-${ts}@resto.test`;
      const adminPassword = 'Password123!';

      const regARes = await gwRequest('POST', '/v1/auth/register', {
        body: {
          restaurantName: `Restaurante A ${ts}`,
          slug: `rest-a-${ts}`,
          adminEmail: adminEmailA,
          adminPassword,
          adminDisplayName: 'Admin A',
        },
      });
      if (regARes.status !== 201 || !regARes.data?.tenant?.id || !regARes.data?.tokens?.accessToken) {
        throw new Error(`[E2E 1/6] Register Tenant A failed: status=${regARes.status} body=${JSON.stringify(regARes.data)}`);
      }
      const tenantAId = regARes.data.tenant.id;

      // Test refresh directly from register token first
      const regRefreshRes = await gwRequest('POST', '/v1/auth/refresh', {
        body: { refreshToken: regARes.data.tokens.refreshToken },
      });
      if (regRefreshRes.status !== 200 || !regRefreshRes.data?.accessToken || !regRefreshRes.data?.refreshToken) {
        throw new Error(`[E2E 1/6] Refresh after register failed: status=${regRefreshRes.status} body=${JSON.stringify(regRefreshRes.data)}`);
      }

      const loginARes = await gwRequest('POST', '/v1/auth/login', {
        body: {
          email: adminEmailA,
          password: adminPassword,
          tenantSlug: `rest-a-${ts}`,
        },
      });
      if (loginARes.status !== 200 || !loginARes.data?.tokens?.accessToken || !loginARes.data?.tokens?.refreshToken) {
        throw new Error(`[E2E 1/6] Login Tenant A failed: status=${loginARes.status} body=${JSON.stringify(loginARes.data)}`);
      }

      const oldRefreshToken = loginARes.data.tokens.refreshToken;
      const refreshARes = await gwRequest('POST', '/v1/auth/refresh', {
        body: { refreshToken: oldRefreshToken },
      });
      if (refreshARes.status !== 200 || !refreshARes.data?.accessToken || !refreshARes.data?.refreshToken) {
        throw new Error(`[E2E 1/6] Refresh after login failed: status=${refreshARes.status} body=${JSON.stringify(refreshARes.data)}`);
      }
      const adminTokenA = refreshARes.data.accessToken;

      const replayRefreshRes = await gwRequest('POST', '/v1/auth/refresh', {
        body: { refreshToken: oldRefreshToken },
      });
      if (replayRefreshRes.status !== 401) {
        throw new Error(`[E2E 1/6] Replay of old refreshToken must fail with 401, got ${replayRefreshRes.status}`);
      }
      log('[E2E 1/6] Auth & Refresh passed.');

      // 2. Catálogo, Roles y Aislamiento (U2, U3 / H3, H4, H5)
      log('[E2E 2/6] Testing Catalog, Roles & Tenant Isolation via Gateway...');
      const createCatRes = await gwGraphql(
        adminTokenA,
        `mutation CreateCat($input: CreateCategoryInput!) { createCategory(input: $input) { id name } }`,
        { input: { name: 'Platos Fuertes', sortOrder: 1 } }
      );
      if (createCatRes.status !== 200 || createCatRes.data?.errors || !createCatRes.data?.data?.createCategory?.id) {
        throw new Error(`[E2E 2/6] createCategory failed: ${JSON.stringify(createCatRes.data)}`);
      }
      const categoryAId = createCatRes.data.data.createCategory.id;

      const createProdRes = await gwGraphql(
        adminTokenA,
        `mutation CreateProd($input: CreateProductInput!) { createProduct(input: $input) { id name price isAvailable } }`,
        { input: { categoryId: categoryAId, name: 'Lomo Saltado', price: 15.5, sortOrder: 1 } }
      );
      if (createProdRes.status !== 200 || createProdRes.data?.errors || !createProdRes.data?.data?.createProduct?.id) {
        throw new Error(`[E2E 2/6] createProduct failed: ${JSON.stringify(createProdRes.data)}`);
      }
      const productAId = createProdRes.data.data.createProduct.id;

      const createModGroupRes = await gwGraphql(
        adminTokenA,
        `mutation CreateMG($input: CreateModifierGroupInput!) { createModifierGroup(input: $input) { id name } }`,
        { input: { name: 'Término de cocción', minSelections: 0, maxSelections: 1, isRequired: false } }
      );
      if (createModGroupRes.status !== 200 || createModGroupRes.data?.errors || !createModGroupRes.data?.data?.createModifierGroup?.id) {
        throw new Error(`[E2E 2/6] createModifierGroup failed: ${JSON.stringify(createModGroupRes.data)}`);
      }
      const modGroupAId = createModGroupRes.data.data.createModifierGroup.id;

      const addModOptRes = await gwGraphql(
        adminTokenA,
        `mutation AddMO($groupId: ID!, $input: AddModifierOptionInput!) { addModifierOption(groupId: $groupId, input: $input) { id name priceDelta } }`,
        { groupId: modGroupAId, input: { name: 'Tres cuartos', priceDelta: 0, isDefault: true } }
      );
      if (addModOptRes.status !== 200 || addModOptRes.data?.errors || !addModOptRes.data?.data?.addModifierOption?.id) {
        throw new Error(`[E2E 2/6] addModifierOption failed: ${JSON.stringify(addModOptRes.data)}`);
      }

      const attachModRes = await gwGraphql(
        adminTokenA,
        `mutation AttachMG($productId: ID!, $groupId: ID!) { attachModifierGroup(productId: $productId, groupId: $groupId) { id modifierGroups { id name } } }`,
        { productId: productAId, groupId: modGroupAId }
      );
      if (attachModRes.status !== 200 || attachModRes.data?.errors || !attachModRes.data?.data?.attachModifierGroup?.id) {
        throw new Error(`[E2E 2/6] attachModifierGroup failed: ${JSON.stringify(attachModRes.data)}`);
      }

      // Register Tenant B to test cross-tenant isolation
      const regBRes = await gwRequest('POST', '/v1/auth/register', {
        body: {
          restaurantName: `Restaurante B ${ts}`,
          slug: `rest-b-${ts}`,
          adminEmail: `admin-b-${ts}@resto.test`,
          adminPassword,
          adminDisplayName: 'Admin B',
        },
      });
      if (regBRes.status !== 201 || !regBRes.data?.tokens?.accessToken) {
        throw new Error(`[E2E 2/6] Register Tenant B failed: status=${regBRes.status}`);
      }
      const adminTokenB = regBRes.data.tokens.accessToken;

      const crossAvailRes = await gwGraphql(
        adminTokenB,
        `mutation CrossAvail($id: ID!, $isAvailable: Boolean!) { setProductAvailability(id: $id, isAvailable: $isAvailable) { id } }`,
        { id: productAId, isAvailable: false }
      );
      const crossAvailCode = crossAvailRes.data?.errors?.[0]?.extensions?.code;
      if (crossAvailCode !== 'NOT_FOUND') {
        throw new Error(`[E2E 2/6] Cross-tenant setProductAvailability must return NOT_FOUND, got: ${JSON.stringify(crossAvailRes.data)}`);
      }

      const crossAttachRes = await gwGraphql(
        adminTokenB,
        `mutation CrossAttach($productId: ID!, $groupId: ID!) { attachModifierGroup(productId: $productId, groupId: $groupId) { id } }`,
        { productId: productAId, groupId: modGroupAId }
      );
      const crossAttachCode = crossAttachRes.data?.errors?.[0]?.extensions?.code;
      if (crossAttachCode !== 'NOT_FOUND') {
        throw new Error(`[E2E 2/6] Cross-tenant attachModifierGroup must return NOT_FOUND, got: ${JSON.stringify(crossAttachRes.data)}`);
      }
      log('[E2E 2/6] Catalog & Tenant Isolation passed.');

      // 3. Mesa y Sesión QR (U7 / H9)
      log('[E2E 3/6] Testing Table & QR Session via Gateway...');
      const createTableRes = await gwRequest('POST', '/v1/tables', {
        token: adminTokenA,
        body: { label: 'Mesa 1' },
      });
      if (createTableRes.status !== 201 || !createTableRes.data?.tableId) {
        throw new Error(`[E2E 3/6] Create table failed: status=${createTableRes.status} body=${JSON.stringify(createTableRes.data)}`);
      }
      const tableId = createTableRes.data.tableId;

      const tableQrRes = await gwRequest('GET', `/v1/tables/${tableId}/qr`, {
        token: adminTokenA,
      });
      if (tableQrRes.status !== 200 || !tableQrRes.data?.url) {
        throw new Error(`[E2E 3/6] GET /v1/tables/:tableId/qr failed: status=${tableQrRes.status} body=${JSON.stringify(tableQrRes.data)}`);
      }
      const qrKey = new URL(tableQrRes.data.url).searchParams.get('k');
      if (!qrKey) {
        throw new Error(`[E2E 3/6] Could not extract qrKey from QR URL: ${tableQrRes.data.url}`);
      }

      const openSessionRes = await gwRequest('POST', '/v1/sessions/open', {
        body: { tenantId: tenantAId, tableId, qrKey },
      });
      if ((openSessionRes.status !== 200 && openSessionRes.status !== 201) || !openSessionRes.data?.guestToken || !openSessionRes.data?.session?.sessionId) {
        throw new Error(`[E2E 3/6] Open QR session failed: status=${openSessionRes.status} body=${JSON.stringify(openSessionRes.data)}`);
      }
      const guestToken = openSessionRes.data.guestToken;
      const sessionId = openSessionRes.data.session.sessionId;

      // Guest can query categories and products
      const guestMenuRes = await gwGraphql(
        guestToken,
        `query GuestMenu { categories { id name } products { id name price modifierGroups { id name options { id name priceDelta } } } }`
      );
      if (guestMenuRes.status !== 200 || guestMenuRes.data?.errors || !guestMenuRes.data?.data?.products?.length) {
        throw new Error(`[E2E 3/6] Guest menu query failed: ${JSON.stringify(guestMenuRes.data)}`);
      }

      // Guest cannot query root modifierGroups -> FORBIDDEN (H4)
      const guestModGroupsRes = await gwGraphql(
        guestToken,
        `query GuestModGroups { modifierGroups { id name } }`
      );
      const guestModGroupsCode = guestModGroupsRes.data?.errors?.[0]?.extensions?.code;
      if (guestModGroupsCode !== 'FORBIDDEN') {
        throw new Error(`[E2E 3/6] Guest root modifierGroups query must return FORBIDDEN, got: ${JSON.stringify(guestModGroupsRes.data)}`);
      }

      // Guest cannot execute catalog mutations -> FORBIDDEN (H3)
      const guestMutRes = await gwGraphql(
        guestToken,
        `mutation GuestCreateCat($input: CreateCategoryInput!) { createCategory(input: $input) { id } }`,
        { input: { name: 'Intruso', sortOrder: 99 } }
      );
      const guestMutCode = guestMutRes.data?.errors?.[0]?.extensions?.code;
      if (guestMutCode !== 'FORBIDDEN') {
        throw new Error(`[E2E 3/6] Guest createCategory mutation must return FORBIDDEN, got: ${JSON.stringify(guestMutRes.data)}`);
      }
      log('[E2E 3/6] Table, QR Session & Guest GraphQL guards passed.');

      // 4. Carrito y Cantidades (U1 / H2)
      log('[E2E 4/6] Testing Cart & Quantity bounds via Gateway...');
      const cartQty100Res = await gwRequest('POST', '/v1/cart/items', {
        token: guestToken,
        body: { productId: productAId, quantity: 100 },
      });
      if (cartQty100Res.status !== 400 || cartQty100Res.data?.error?.code !== 'VALIDATION_ERROR') {
        throw new Error(`[E2E 4/6] POST /v1/cart/items with quantity=100 must return 400 VALIDATION_ERROR, got status=${cartQty100Res.status} body=${JSON.stringify(cartQty100Res.data)}`);
      }

      const cartQtyNegRes = await gwRequest('POST', '/v1/cart/items', {
        token: guestToken,
        body: { productId: productAId, quantity: -3 },
      });
      if (cartQtyNegRes.status !== 400 || cartQtyNegRes.data?.error?.code !== 'VALIDATION_ERROR') {
        throw new Error(`[E2E 4/6] POST /v1/cart/items with quantity=-3 must return 400 VALIDATION_ERROR, got status=${cartQtyNegRes.status} body=${JSON.stringify(cartQtyNegRes.data)}`);
      }

      const cartValidRes = await gwRequest('POST', '/v1/cart/items', {
        token: guestToken,
        body: {
          productId: productAId,
          quantity: 2,
          modifiers: [],
          display: { productName: 'Lomo Saltado', unitPrice: 15.5, modifierNames: [] },
        },
      });
      if (cartValidRes.status !== 200 && cartValidRes.status !== 201) {
        throw new Error(`[E2E 4/6] Valid POST /v1/cart/items failed: status=${cartValidRes.status} body=${JSON.stringify(cartValidRes.data)}`);
      }
      log('[E2E 4/6] Cart & Quantity bounds passed.');

      // 5. Confirmar Pedido y KDS (U4 / H6, H7)
      log('[E2E 5/6] Testing Order Confirmation, STAFF cancellation guard & KDS flow via Gateway...');
      const confirmOrderRes = await gwRequest('POST', '/v1/orders/confirm', {
        token: guestToken,
        body: { tableId },
      });
      if (confirmOrderRes.status !== 201 || confirmOrderRes.data?.status !== 'PLACED' || !confirmOrderRes.data?.id) {
        throw new Error(`[E2E 5/6] POST /v1/orders/confirm failed: status=${confirmOrderRes.status} body=${JSON.stringify(confirmOrderRes.data)}`);
      }
      const orderId = confirmOrderRes.data.id;

      // Create & login a STAFF user in Tenant A to verify H7
      const staffEmail = `staff-a-${ts}@resto.test`;
      const inviteStaffRes = await gwRequest('POST', '/v1/identity/users', {
        token: adminTokenA,
        body: {
          email: staffEmail,
          displayName: 'Staff User',
          password: adminPassword,
          role: 'STAFF',
        },
      });
      if (inviteStaffRes.status !== 201) {
        throw new Error(`[E2E 5/6] Invite STAFF user failed: status=${inviteStaffRes.status} body=${JSON.stringify(inviteStaffRes.data)}`);
      }

      const loginStaffRes = await gwRequest('POST', '/v1/auth/login', {
        body: {
          email: staffEmail,
          password: adminPassword,
          tenantSlug: `rest-a-${ts}`,
        },
      });
      if (loginStaffRes.status !== 200 || !loginStaffRes.data?.tokens?.accessToken) {
        throw new Error(`[E2E 5/6] Login STAFF user failed: status=${loginStaffRes.status}`);
      }
      const staffTokenA = loginStaffRes.data.tokens.accessToken;

      const staffCancelViaStatusRes = await gwRequest('PATCH', `/v1/orders/${orderId}/status`, {
        token: staffTokenA,
        body: { status: 'CANCELLED' },
      });
      if (staffCancelViaStatusRes.status !== 403) {
        throw new Error(`[E2E 5/6] STAFF PATCH /v1/orders/:id/status CANCELLED must return 403, got ${staffCancelViaStatusRes.status}`);
      }

      for (const nextStatus of ['IN_KITCHEN', 'READY', 'DELIVERED']) {
        const kdsRes = await gwRequest('PATCH', `/v1/orders/${orderId}/status`, {
          token: adminTokenA,
          body: { status: nextStatus },
        });
        if (kdsRes.status !== 200 || kdsRes.data?.status !== nextStatus) {
          throw new Error(`[E2E 5/6] KDS transition to ${nextStatus} failed: status=${kdsRes.status} body=${JSON.stringify(kdsRes.data)}`);
        }
      }
      log('[E2E 5/6] Order Confirmation & KDS flow passed.');

      // 6. Checkout y Rechazo Post-pago (U4 / H6, H12)
      log('[E2E 6/6] Testing Checkout & Post-payment Rejection via Gateway...');
      const billRes = await gwRequest('GET', `/v1/checkout/${sessionId}`, {
        token: adminTokenA,
      });
      if (billRes.status !== 200 || Number(billRes.data?.total) !== 31) {
        throw new Error(`[E2E 6/6] GET /v1/checkout/:sessionId failed or unexpected total: status=${billRes.status} body=${JSON.stringify(billRes.data)}`);
      }

      const checkoutRes = await gwRequest('POST', '/v1/checkout/confirm', {
        token: adminTokenA,
        body: { sessionId, tableId, method: 'CASH' },
      });
      if (checkoutRes.status !== 201 || Number(checkoutRes.data?.payment?.amount) !== 31) {
        throw new Error(`[E2E 6/6] POST /v1/checkout/confirm failed: status=${checkoutRes.status} body=${JSON.stringify(checkoutRes.data)}`);
      }

      const postPaidCartRes = await gwRequest('POST', '/v1/cart/items', {
        token: guestToken,
        body: { productId: productAId, quantity: 1 },
      });
      if (postPaidCartRes.status !== 409 || postPaidCartRes.data?.error?.code !== 'SESSION_NOT_ACTIVE') {
        throw new Error(`[E2E 6/6] Post-payment POST /v1/cart/items must return 409 SESSION_NOT_ACTIVE, got status=${postPaidCartRes.status} body=${JSON.stringify(postPaidCartRes.data)}`);
      }

      const postPaidOrderRes = await gwRequest('POST', '/v1/orders/confirm', {
        token: guestToken,
        body: { tableId },
      });
      if (postPaidOrderRes.status !== 409 || postPaidOrderRes.data?.error?.code !== 'SESSION_NOT_ACTIVE') {
        throw new Error(`[E2E 6/6] Post-payment POST /v1/orders/confirm must return 409 SESSION_NOT_ACTIVE, got status=${postPaidOrderRes.status} body=${JSON.stringify(postPaidOrderRes.data)}`);
      }
      log('[E2E 6/6] Checkout & Post-payment Rejection passed.');

      // 7. Gestión de Mesas en Lote vía Gateway (mesas-lote)
      log('[E2E 7/7] Testing Batch Table Management via Gateway (mesas-lote)...');

      // 1. POST /v1/tables/batch con prefix 'Terraza' (count: 5, start: 1)
      const batchCreateRes = await gwRequest('POST', '/v1/tables/batch', {
        token: adminTokenA,
        body: { prefix: 'Terraza', count: 5, start: 1 },
      });
      if (
        batchCreateRes.status !== 201 ||
        !Array.isArray(batchCreateRes.data?.tables) ||
        batchCreateRes.data.tables.length !== 5
      ) {
        throw new Error(
          `[E2E 7/7] POST /v1/tables/batch failed: status=${batchCreateRes.status} body=${JSON.stringify(
            batchCreateRes.data
          )}`
        );
      }
      const [terraza1, terraza2, terraza3, terraza4, terraza5] = batchCreateRes.data.tables;
      if (
        terraza1?.label !== 'Terraza 1' ||
        terraza2?.label !== 'Terraza 2' ||
        terraza3?.label !== 'Terraza 3' ||
        terraza4?.label !== 'Terraza 4' ||
        terraza5?.label !== 'Terraza 5'
      ) {
        throw new Error(
          `[E2E 7/7] Batch created tables do not have expected labels: ${JSON.stringify(
            batchCreateRes.data.tables.map((t) => t.label)
          )}`
        );
      }

      // 2. Conflicto 409 al reusar label existente (insensible a mayúsculas/espacios)
      const conflictRes = await gwRequest('POST', '/v1/tables/batch', {
        token: adminTokenA,
        body: { labels: ['  terraza 1  '] },
      });
      if (
        conflictRes.status !== 409 ||
        conflictRes.data?.error?.code !== 'TABLE_LABEL_TAKEN' ||
        !Array.isArray(conflictRes.data?.error?.details?.conflicts)
      ) {
        throw new Error(
          `[E2E 7/7] POST /v1/tables/batch duplicate label must return 409 TABLE_LABEL_TAKEN with details.conflicts, got status=${
            conflictRes.status
          } body=${JSON.stringify(conflictRes.data)}`
        );
      }

      // 3. PATCH /v1/tables/batch con swap de labels y status: inactive
      const patchSwapRes = await gwRequest('PATCH', '/v1/tables/batch', {
        token: adminTokenA,
        body: {
          updates: [
            { tableId: terraza1.tableId, label: 'Terraza 2' },
            { tableId: terraza2.tableId, label: 'Terraza 1' },
            { tableId: terraza3.tableId, status: 'inactive' },
          ],
        },
      });
      if (patchSwapRes.status !== 200 || !Array.isArray(patchSwapRes.data?.tables)) {
        throw new Error(
          `[E2E 7/7] PATCH /v1/tables/batch swap failed: status=${patchSwapRes.status} body=${JSON.stringify(
            patchSwapRes.data
          )}`
        );
      }
      const updatedT1 = patchSwapRes.data.tables.find((t) => t.tableId === terraza1.tableId);
      const updatedT2 = patchSwapRes.data.tables.find((t) => t.tableId === terraza2.tableId);
      const updatedT3 = patchSwapRes.data.tables.find((t) => t.tableId === terraza3.tableId);
      if (
        updatedT1?.label !== 'Terraza 2' ||
        updatedT2?.label !== 'Terraza 1' ||
        updatedT3?.status !== 'inactive'
      ) {
        throw new Error(
          `[E2E 7/7] PATCH /v1/tables/batch swap verification failed: ${JSON.stringify(
            patchSwapRes.data.tables
          )}`
        );
      }

      // 4. Abrir sesión en una de las mesas activas (terraza4)
      const qrRes4 = await gwRequest('GET', `/v1/tables/${terraza4.tableId}/qr`, {
        token: adminTokenA,
      });
      if (qrRes4.status !== 200 || !qrRes4.data?.url) {
        throw new Error(
          `[E2E 7/7] GET /v1/tables/:tableId/qr for terraza4 failed: status=${qrRes4.status} body=${JSON.stringify(
            qrRes4.data
          )}`
        );
      }
      const qrKey4 = new URL(qrRes4.data.url).searchParams.get('k');
      if (!qrKey4) {
        throw new Error(`[E2E 7/7] Could not extract qrKey for terraza4: ${qrRes4.data.url}`);
      }

      const openSessionRes4 = await gwRequest('POST', '/v1/sessions/open', {
        body: { tenantId: tenantAId, tableId: terraza4.tableId, qrKey: qrKey4 },
      });
      if (
        (openSessionRes4.status !== 200 && openSessionRes4.status !== 201) ||
        !openSessionRes4.data?.session?.sessionId
      ) {
        throw new Error(
          `[E2E 7/7] POST /v1/sessions/open for terraza4 failed: status=${openSessionRes4.status} body=${JSON.stringify(
            openSessionRes4.data
          )}`
        );
      }
      const sessionId4 = openSessionRes4.data.session.sessionId;

      // 5. POST /v1/tables/batch/delete con mesa ocupada y mesa libre
      const batchDeleteRes = await gwRequest('POST', '/v1/tables/batch/delete', {
        token: adminTokenA,
        body: { tableIds: [terraza4.tableId, terraza5.tableId] },
      });
      if (batchDeleteRes.status !== 200) {
        throw new Error(
          `[E2E 7/7] POST /v1/tables/batch/delete failed: status=${batchDeleteRes.status} body=${JSON.stringify(
            batchDeleteRes.data
          )}`
        );
      }
      const deletedIds = batchDeleteRes.data?.deleted || [];
      const failedItems = batchDeleteRes.data?.failed || [];
      if (
        !deletedIds.includes(terraza5.tableId) ||
        deletedIds.includes(terraza4.tableId) ||
        deletedIds.length !== 1
      ) {
        throw new Error(
          `[E2E 7/7] Expected terraza5 deleted and terraza4 retained: ${JSON.stringify(
            batchDeleteRes.data
          )}`
        );
      }
      const failedT4 = failedItems.find((f) => f.tableId === terraza4.tableId);
      if (!failedT4 || failedT4.code !== 'TABLE_HAS_ACTIVE_SESSION') {
        throw new Error(
          `[E2E 7/7] Expected failed reason TABLE_HAS_ACTIVE_SESSION for terraza4: ${JSON.stringify(
            batchDeleteRes.data
          )}`
        );
      }

      // 6. Efectos del borrado lógico de terraza5
      const listTablesRes = await gwRequest('GET', '/v1/tables', {
        token: adminTokenA,
      });
      if (listTablesRes.status !== 200 || !Array.isArray(listTablesRes.data)) {
        throw new Error(`[E2E 7/7] GET /v1/tables failed: status=${listTablesRes.status}`);
      }
      if (listTablesRes.data.some((t) => t.tableId === terraza5.tableId)) {
        throw new Error(
          `[E2E 7/7] Deleted table terraza5 must not appear in GET /v1/tables`
        );
      }

      const openDeletedRes = await gwRequest('POST', '/v1/sessions/open', {
        body: { tenantId: tenantAId, tableId: terraza5.tableId, qrKey: 'dummy-qr-key' },
      });
      if (openDeletedRes.status !== 404 || openDeletedRes.data?.error?.code !== 'TABLE_NOT_FOUND') {
        throw new Error(
          `[E2E 7/7] POST /v1/sessions/open on deleted table must return 404 TABLE_NOT_FOUND, got status=${
            openDeletedRes.status
          } body=${JSON.stringify(openDeletedRes.data)}`
        );
      }

      const qrDeletedRes = await gwRequest('GET', `/v1/tables/${terraza5.tableId}/qr`, {
        token: adminTokenA,
      });
      if (qrDeletedRes.status !== 404 || qrDeletedRes.data?.error?.code !== 'TABLE_NOT_FOUND') {
        throw new Error(
          `[E2E 7/7] GET /v1/tables/:tableId/qr on deleted table must return 404 TABLE_NOT_FOUND, got status=${
            qrDeletedRes.status
          } body=${JSON.stringify(qrDeletedRes.data)}`
        );
      }

      const recreateRes = await gwRequest('POST', '/v1/tables/batch', {
        token: adminTokenA,
        body: { labels: ['Terraza 5'] },
      });
      if (
        recreateRes.status !== 201 ||
        !Array.isArray(recreateRes.data?.tables) ||
        recreateRes.data.tables.length !== 1
      ) {
        throw new Error(
          `[E2E 7/7] Recreating released label 'Terraza 5' failed: status=${
            recreateRes.status
          } body=${JSON.stringify(recreateRes.data)}`
        );
      }
      const recreatedT5 = recreateRes.data.tables[0];
      if (recreatedT5.tableId === terraza5.tableId) {
        throw new Error(
          `[E2E 7/7] Recreated table must receive a new tableId, got same: ${recreatedT5.tableId}`
        );
      }

      // 7. Guards de rol STAFF (403 Forbidden)
      const staffCreateRes = await gwRequest('POST', '/v1/tables/batch', {
        token: staffTokenA,
        body: { labels: ['Staff 1'] },
      });
      if (staffCreateRes.status !== 403) {
        throw new Error(
          `[E2E 7/7] STAFF POST /v1/tables/batch must return 403, got ${staffCreateRes.status}`
        );
      }

      const staffPatchRes = await gwRequest('PATCH', '/v1/tables/batch', {
        token: staffTokenA,
        body: { updates: [{ tableId: terraza1.tableId, label: 'Staff Edit' }] },
      });
      if (staffPatchRes.status !== 403) {
        throw new Error(
          `[E2E 7/7] STAFF PATCH /v1/tables/batch must return 403, got ${staffPatchRes.status}`
        );
      }

      const staffDeleteRes = await gwRequest('POST', '/v1/tables/batch/delete', {
        token: staffTokenA,
        body: { tableIds: [terraza1.tableId] },
      });
      if (staffDeleteRes.status !== 403) {
        throw new Error(
          `[E2E 7/7] STAFF POST /v1/tables/batch/delete must return 403, got ${staffDeleteRes.status}`
        );
      }

      // 8. Aislamiento Cross-Tenant (Tenant B no puede mutar mesas de Tenant A)
      const crossPatchRes = await gwRequest('PATCH', '/v1/tables/batch', {
        token: adminTokenB,
        body: { updates: [{ tableId: terraza1.tableId, label: 'Tenant B Infiltration' }] },
      });
      if (crossPatchRes.status !== 404 || crossPatchRes.data?.error?.code !== 'TABLE_NOT_FOUND') {
        throw new Error(
          `[E2E 7/7] Cross-tenant PATCH /v1/tables/batch must return 404 TABLE_NOT_FOUND, got status=${
            crossPatchRes.status
          } body=${JSON.stringify(crossPatchRes.data)}`
        );
      }

      const crossDeleteRes = await gwRequest('POST', '/v1/tables/batch/delete', {
        token: adminTokenB,
        body: { tableIds: [terraza1.tableId] },
      });
      if (crossDeleteRes.status !== 409 || crossDeleteRes.data?.error?.code !== 'TABLES_NOT_DELETABLE') {
        throw new Error(
          `[E2E 7/7] Cross-tenant POST /v1/tables/batch/delete must return 409 TABLES_NOT_DELETABLE, got status=${
            crossDeleteRes.status
          } body=${JSON.stringify(crossDeleteRes.data)}`
        );
      }

      // Cerrar sesión en terraza4 y verificar que ahora sí se puede borrar
      const closeSessionRes = await gwRequest('PATCH', `/v1/sessions/${sessionId4}/close`, {
        token: adminTokenA,
      });
      if (closeSessionRes.status !== 200) {
        throw new Error(
          `[E2E 7/7] Close session on terraza4 failed: status=${closeSessionRes.status} body=${JSON.stringify(
            closeSessionRes.data
          )}`
        );
      }

      const deleteAfterCloseRes = await gwRequest('POST', '/v1/tables/batch/delete', {
        token: adminTokenA,
        body: { tableIds: [terraza4.tableId] },
      });
      if (
        deleteAfterCloseRes.status !== 200 ||
        !deleteAfterCloseRes.data?.deleted?.includes(terraza4.tableId)
      ) {
        throw new Error(
          `[E2E 7/7] POST /v1/tables/batch/delete after session close failed: status=${
            deleteAfterCloseRes.status
          } body=${JSON.stringify(deleteAfterCloseRes.data)}`
        );
      }

      log('[E2E 7/7] Batch Table Management (mesas-lote) passed.');

      log('Gateway traversal verified successfully.');
    }

    log('=============================================');
    log('Harness run complete: ALL TESTS PASSED GREEN');
    log('=============================================');
  } catch (err) {
    error(`Test hardening failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMainModule) {
  main();
}
