import Redis from 'ioredis';
import crypto from 'crypto';
import { DomainError, TableDTO } from '@packages/shared-types';
import { RedisTableRepository } from '../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../src/infrastructure/redis/RedisTableSessionRepository';
import { OpenTableSessionUseCaseImpl } from '../src/application/SessionUseCases';
import { JwtGuestTokenIssuer } from '../src/infrastructure/security/JwtGuestTokenIssuer';
import { RedisKeys } from '../src/infrastructure/redis/keys';

describe('U2: RedisTableRepository y RedisTableSessionRepository Lote y Concurrencia (Real Redis)', () => {
  const jwtSecret = 'test-jwt-secret-hardening-u2';
  const clients: Redis[] = [];

  function createRedisClient(): Redis {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Missing required env REDIS_URL for test:real');
    }
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    clients.push(client);
    return client;
  }

  let mainRedis: Redis;
  let tokenIssuer: JwtGuestTokenIssuer;
  const createdTenants: string[] = [];

  beforeAll(async () => {
    mainRedis = createRedisClient();
    tokenIssuer = new JwtGuestTokenIssuer(jwtSecret);
  });

  afterAll(async () => {
    if (mainRedis) {
      for (const tenantId of createdTenants) {
        const tenantKeys = await mainRedis.keys(`*${tenantId}*`);
        if (tenantKeys.length > 0) {
          await mainRedis.del(...tenantKeys);
        }
      }
    }

    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.quit();
        } catch {
          // ignore
        }
      })
    );
  });

  function generateTenant(prefix: string): string {
    const tenantId = `tenant-u2-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    createdTenants.push(tenantId);
    return tenantId;
  }

  // (a) createMany de 20 mesas crea las 20 y listByTenant las devuelve
  test('(a) createMany de 20 mesas crea las 20 y listByTenant las devuelve', async () => {
    const tenantId = generateTenant('a');
    const tableRepo = new RedisTableRepository(mainRedis);

    const tablesToCreate = Array.from({ length: 20 }, (_, i) => ({
      tableId: `tb-a-${i + 1}`,
      tenantId,
      label: `Mesa ${i + 1}`,
      status: 'active' as const,
      qrKey: `qr-key-${i + 1}`,
      createdAt: new Date().toISOString(),
    }));

    const created = await tableRepo.createMany(tenantId, tablesToCreate);
    expect(created).toHaveLength(20);
    expect(created[0]).not.toHaveProperty('qrKey');
    expect(created[0]).not.toHaveProperty('labelKey');

    const list = await tableRepo.listByTenant(tenantId);
    expect(list).toHaveLength(20);
    const labels = list.map((t) => t.label).sort();
    const expectedLabels = tablesToCreate.map((t) => t.label).sort();
    expect(labels).toEqual(expectedLabels);
  });

  // (b) createMany con una etiqueta ya existente rechaza el lote entero (0 creadas)
  test('(b) createMany con una etiqueta ya existente rechaza el lote entero (0 creadas)', async () => {
    const tenantId = generateTenant('b');
    const tableRepo = new RedisTableRepository(mainRedis);

    // Crear Mesa 1
    await tableRepo.save(tenantId, {
      tableId: 'tb-b-init',
      tenantId,
      label: 'Mesa 1',
      status: 'active',
      qrKey: 'qr-init',
      createdAt: new Date().toISOString(),
    });

    // Intentar lote con Mesa 2, Mesa 3 y una colisión '  mESA 1  '
    const batch = [
      {
        tableId: 'tb-b-2',
        tenantId,
        label: 'Mesa 2',
        status: 'active' as const,
        qrKey: 'qr-2',
        createdAt: new Date().toISOString(),
      },
      {
        tableId: 'tb-b-collision',
        tenantId,
        label: '  mESA 1  ',
        status: 'active' as const,
        qrKey: 'qr-coll',
        createdAt: new Date().toISOString(),
      },
    ];

    let error: any;
    try {
      await tableRepo.createMany(tenantId, batch);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('TABLE_LABEL_TAKEN');
    expect(error.details?.conflicts).toContain('mesa 1');

    // Verificar que NINGUNA mesa del lote fue creada
    const list = await tableRepo.listByTenant(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Mesa 1');
  });

  // (c) 20 llamadas concurrentes a createMany intentando crear "Mesa 1" en el mismo tenant -> exactamente 1 gana y 19 fallan con TABLE_LABEL_TAKEN
  test('(c) 20 llamadas concurrentes a createMany intentando crear "Mesa 1" en el mismo tenant -> exactamente 1 gana y 19 fallan con TABLE_LABEL_TAKEN', async () => {
    const tenantId = generateTenant('c');

    const concurrentCalls = Array.from({ length: 20 }, (_, i) => {
      const client = createRedisClient();
      const repo = new RedisTableRepository(client);
      return repo.createMany(tenantId, [
        {
          tableId: `tb-c-${i}`,
          tenantId,
          label: 'Mesa 1',
          status: 'active',
          qrKey: `qr-c-${i}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    const results = await Promise.allSettled(concurrentCalls);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);

    for (const rej of rejected) {
      const reason = (rej as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(DomainError);
      expect(reason.code).toBe('TABLE_LABEL_TAKEN');
    }

    const tableRepo = new RedisTableRepository(mainRedis);
    const list = await tableRepo.listByTenant(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Mesa 1');
  });

  // (d) updateMany con swap A <-> B en la misma llamada funciona; con colisión contra C existente aborta todo el lote
  test('(d) updateMany con swap A <-> B en la misma llamada funciona; con colisión contra C existente aborta todo el lote', async () => {
    const tenantId = generateTenant('d');
    const tableRepo = new RedisTableRepository(mainRedis);

    await tableRepo.createMany(tenantId, [
      {
        tableId: 'tb-d-A',
        tenantId,
        label: 'Mesa A',
        status: 'active',
        qrKey: 'qr-A',
        createdAt: new Date().toISOString(),
      },
      {
        tableId: 'tb-d-B',
        tenantId,
        label: 'Mesa B',
        status: 'active',
        qrKey: 'qr-B',
        createdAt: new Date().toISOString(),
      },
      {
        tableId: 'tb-d-C',
        tenantId,
        label: 'Mesa C',
        status: 'active',
        qrKey: 'qr-C',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Swap A <-> B
    const swapped = await tableRepo.updateMany(tenantId, [
      { tableId: 'tb-d-A', label: 'Mesa B' },
      { tableId: 'tb-d-B', label: 'Mesa A' },
    ]);

    expect(swapped).toHaveLength(2);
    const updatedA = await tableRepo.findById(tenantId, 'tb-d-A');
    const updatedB = await tableRepo.findById(tenantId, 'tb-d-B');
    expect(updatedA?.label).toBe('Mesa B');
    expect(updatedB?.label).toBe('Mesa A');

    // Intentar colisión contra Mesa C existente: Mesa A -> Mesa C, Mesa B -> Mesa Z
    let error: any;
    try {
      await tableRepo.updateMany(tenantId, [
        { tableId: 'tb-d-A', label: 'Mesa C' },
        { tableId: 'tb-d-B', label: 'Mesa Z' },
      ]);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('TABLE_LABEL_TAKEN');

    // Verificar atomicidad: el lote entero abortó (Mesa B sigue siendo Mesa A, no Mesa Z)
    const afterFailedA = await tableRepo.findById(tenantId, 'tb-d-A');
    const afterFailedB = await tableRepo.findById(tenantId, 'tb-d-B');
    expect(afterFailedA?.label).toBe('Mesa B');
    expect(afterFailedB?.label).toBe('Mesa A');
  });

  // (e) softDeleteMany con mezcla de mesa libre, mesa con sesión activa y tableId inexistente
  test('(e) softDeleteMany con mezcla de mesa libre, mesa con sesión activa y tableId inexistente', async () => {
    const tenantId = generateTenant('e');
    const tableRepo = new RedisTableRepository(mainRedis);
    const sessionRepo = new RedisTableSessionRepository(mainRedis);

    await tableRepo.createMany(tenantId, [
      {
        tableId: 'tb-e-free',
        tenantId,
        label: 'Mesa Libre',
        status: 'active',
        qrKey: 'qr-free-old',
        createdAt: new Date().toISOString(),
      },
      {
        tableId: 'tb-e-busy',
        tenantId,
        label: 'Mesa Ocupada',
        status: 'active',
        qrKey: 'qr-busy-old',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Crear sesión activa en tb-e-busy
    const now = new Date();
    await sessionRepo.save(
      tenantId,
      {
        sessionId: 'sess-e-busy',
        tenantId,
        tableId: 'tb-e-busy',
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 3600000).toISOString(),
      },
      3600
    );

    const deleteResult = await tableRepo.softDeleteMany(tenantId, [
      { tableId: 'tb-e-free', deletedAt: new Date().toISOString(), newQrKey: 'qr-free-new' },
      { tableId: 'tb-e-busy', deletedAt: new Date().toISOString(), newQrKey: 'qr-busy-new' },
      { tableId: 'tb-e-nonexistent', deletedAt: new Date().toISOString(), newQrKey: 'qr-none-new' },
    ]);

    expect(deleteResult.deleted).toEqual(['tb-e-free']);
    expect(deleteResult.failed).toEqual([
      { tableId: 'tb-e-busy', code: 'TABLE_HAS_ACTIVE_SESSION' },
      { tableId: 'tb-e-nonexistent', code: 'TABLE_NOT_FOUND' },
    ]);

    // findById conserva el registro de la libre pero con status deleted y qrKey rotada
    const deletedRecord = await tableRepo.findById(tenantId, 'tb-e-free');
    expect(deletedRecord).not.toBeNull();
    expect(deletedRecord?.status).toBe('deleted');
    expect(deletedRecord?.qrKey).toBe('qr-free-new');
    expect(deletedRecord?.deletedAt).toBeDefined();

    // La ocupada permanece activa con su qrKey intacta
    const busyRecord = await tableRepo.findById(tenantId, 'tb-e-busy');
    expect(busyRecord?.status).toBe('active');
    expect(busyRecord?.qrKey).toBe('qr-busy-old');

    // listByTenant excluye la mesa borrada
    const list = await tableRepo.listByTenant(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].tableId).toBe('tb-e-busy');

    // Libera su label: permite crear de nuevo 'Mesa Libre' de inmediato
    const recreated = await tableRepo.createMany(tenantId, [
      {
        tableId: 'tb-e-free-reborn',
        tenantId,
        label: 'Mesa Libre',
        status: 'active',
        qrKey: 'qr-reborn',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(recreated).toHaveLength(1);
    expect(recreated[0].tableId).toBe('tb-e-free-reborn');
  });

  // (f) Tope de 500 mesas vivas por tenant: las deleted no cuentan hacia el tope; superar 500 vivas lanza TABLE_LIMIT_EXCEEDED
  test('(f) Tope de 500 mesas vivas por tenant: las deleted no cuentan hacia el tope; superar 500 vivas lanza TABLE_LIMIT_EXCEEDED', async () => {
    const tenantId = generateTenant('f');
    const tableRepo = new RedisTableRepository(mainRedis);

    // Crear 500 mesas vivas
    const batch500 = Array.from({ length: 500 }, (_, i) => ({
      tableId: `tb-f-${i + 1}`,
      tenantId,
      label: `Mesa ${i + 1}`,
      status: 'active' as const,
      qrKey: `qr-f-${i + 1}`,
      createdAt: new Date().toISOString(),
    }));

    await tableRepo.createMany(tenantId, batch500);

    // Intentar crear 1 más -> TABLE_LIMIT_EXCEEDED
    let limitErr: any;
    try {
      await tableRepo.createMany(tenantId, [
        {
          tableId: 'tb-f-501',
          tenantId,
          label: 'Mesa 501',
          status: 'active',
          qrKey: 'qr-f-501',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      limitErr = err;
    }

    expect(limitErr).toBeInstanceOf(DomainError);
    expect(limitErr.code).toBe('TABLE_LIMIT_EXCEEDED');
    expect(limitErr.details).toMatchObject({
      current: 500,
      requested: 1,
      max: 500,
    });

    // Borrar 1 mesa
    await tableRepo.softDeleteMany(tenantId, [
      { tableId: 'tb-f-1', deletedAt: new Date().toISOString(), newQrKey: 'qr-f-del' },
    ]);

    // Ahora hay 499 vivas; crear 'Mesa 501' debe tener éxito
    const created501 = await tableRepo.createMany(tenantId, [
      {
        tableId: 'tb-f-501',
        tenantId,
        label: 'Mesa 501',
        status: 'active',
        qrKey: 'qr-f-501',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(created501).toHaveLength(1);
    expect(created501[0].tableId).toBe('tb-f-501');
  }, 15000);

  // (g) Concurrencia softDeleteMany vs apertura de sesión en bucle de 20 iteraciones
  test('(g) Concurrencia softDeleteMany vs apertura de sesión en bucle de 20 iteraciones', async () => {
    const tenantId = generateTenant('g');

    for (let i = 0; i < 20; i++) {
      const tableId = `tb-g-${i}`;
      const qrKey = `qr-g-${i}`;

      const clientSetup = createRedisClient();
      const repoSetup = new RedisTableRepository(clientSetup);
      await repoSetup.save(tenantId, {
        tableId,
        tenantId,
        label: `Mesa G ${i}`,
        status: 'active',
        qrKey,
        createdAt: new Date().toISOString(),
      });

      const client1 = createRedisClient();
      const client2 = createRedisClient();

      const tableRepo1 = new RedisTableRepository(client1);
      const sessionRepo2 = new RedisTableSessionRepository(client2);
      const tableRepo2 = new RedisTableRepository(client2);
      const openUseCase = new OpenTableSessionUseCaseImpl(sessionRepo2, tableRepo2, tokenIssuer, 14400);

      // Lanzar simultáneamente delete vs open session
      const deletePromise = tableRepo1.softDeleteMany(tenantId, [
        { tableId, deletedAt: new Date().toISOString(), newQrKey: `qr-rotated-${i}` },
      ]);

      const openPromise = openUseCase.execute({
        tenantId,
        tableId,
        qrKey,
      });

      const [delResult, openResult] = await Promise.allSettled([deletePromise, openPromise]);

      // Invariante estricto:
      // Si la mesa quedó deleted -> NUNCA debe haber puntero activo
      // Si la mesa tiene puntero activo -> NUNCA debe tener status: deleted
      const finalTable = await repoSetup.findById(tenantId, tableId);
      const activePointer = await mainRedis.get(RedisKeys.tableSessionPointer(tenantId, tableId));

      if (finalTable?.status === 'deleted') {
        // El puntero activo NO debe existir
        expect(activePointer).toBeNull();
        // Si el delete ganó, la apertura debió fallar (o con TABLE_NOT_FOUND o QR_KEY_INVALID)
        if (openResult.status === 'rejected') {
          const errCode = (openResult.reason as DomainError).code;
          expect(['TABLE_NOT_FOUND', 'TABLE_INACTIVE', 'QR_KEY_INVALID']).toContain(errCode);
        }
      } else {
        // La mesa quedó activa, por ende el delete debió fallar por sesión activa
        expect(finalTable?.status).toBe('active');
        if (delResult.status === 'fulfilled') {
          expect(delResult.value.failed).toEqual([
            { tableId, code: 'TABLE_HAS_ACTIVE_SESSION' },
          ]);
        }
      }
    }
  }, 30000);

  // (h) Mesa legacy creada con save() o insertada en Redis sin campo labelKey
  test('(h) Mesa legacy creada con save() o sin labelKey impide duplicados (incluyendo acentos/mayúsculas) y aislamiento tenant', async () => {
    const tenantId1 = generateTenant('h1');
    const tenantId2 = generateTenant('h2');
    const tableRepo1 = new RedisTableRepository(mainRedis);
    const tableRepo2 = new RedisTableRepository(mainRedis);

    // 1. Insertar mesa legacy directamente en Redis sin campo labelKey y con acento
    const legacyKey = RedisKeys.table(tenantId1, 'tb-legacy-1');
    await mainRedis.set(
      legacyKey,
      JSON.stringify({
        tableId: 'tb-legacy-1',
        tenantId: tenantId1,
        label: 'Salón VIP',
        status: 'active',
        qrKey: 'qr-legacy-1',
        createdAt: new Date().toISOString(),
      })
    );
    await mainRedis.sadd(RedisKeys.tenantTables(tenantId1), 'tb-legacy-1');

    // 2. createMany en tenantId1 con '  salón vip  ' -> debe fallar con TABLE_LABEL_TAKEN
    let err1: any;
    try {
      await tableRepo1.createMany(tenantId1, [
        {
          tableId: 'tb-h1-new',
          tenantId: tenantId1,
          label: '  salón vip  ',
          status: 'active',
          qrKey: 'qr-new',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      err1 = err;
    }
    expect(err1).toBeInstanceOf(DomainError);
    expect(err1.code).toBe('TABLE_LABEL_TAKEN');

    // 3. updateMany sobre otra mesa intentando renombrarla a 'SALÓN VIP' -> debe fallar con TABLE_LABEL_TAKEN
    await tableRepo1.createMany(tenantId1, [
      {
        tableId: 'tb-h1-other',
        tenantId: tenantId1,
        label: 'Mesa Otra',
        status: 'active',
        qrKey: 'qr-other',
        createdAt: new Date().toISOString(),
      },
    ]);

    let err2: any;
    try {
      await tableRepo1.updateMany(tenantId1, [
        { tableId: 'tb-h1-other', label: 'SALÓN VIP' },
      ]);
    } catch (err) {
      err2 = err;
    }
    expect(err2).toBeInstanceOf(DomainError);
    expect(err2.code).toBe('TABLE_LABEL_TAKEN');

    // 4. Aislamiento multi-tenant: en tenantId2 'Salón VIP' DEBE permitirse
    const createdTenant2 = await tableRepo2.createMany(tenantId2, [
      {
        tableId: 'tb-h2-salon',
        tenantId: tenantId2,
        label: 'Salón VIP',
        status: 'active',
        qrKey: 'qr-h2',
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(createdTenant2).toHaveLength(1);
    expect(createdTenant2[0].label).toBe('Salón VIP');
  });
});
