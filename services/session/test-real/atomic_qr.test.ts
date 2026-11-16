import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
} from '../src/application/SessionUseCases';
import { RedisTableSessionRepository } from '../src/infrastructure/redis/RedisTableSessionRepository';
import { RedisTableRepository } from '../src/infrastructure/redis/RedisTableRepository';
import { JwtGuestTokenIssuer } from '../src/infrastructure/security/JwtGuestTokenIssuer';
import { RedisKeys } from '../src/infrastructure/redis/keys';
import { TableDTO } from '@packages/shared-types';

describe('U7: Elegir una sesión QR por mesa atómicamente (Real Redis)', () => {
  const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test';
  const clients: Redis[] = [];

  function createRedisClient(): Redis {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'Missing required env REDIS_URL for test:real (refusing to fall back to dev Redis)'
      );
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
      // Limpieza selectiva: solo claves asociadas a los tenants de prueba creados
      for (const tenantId of createdTenants) {
        const tenantKeys = await mainRedis.keys(`*${tenantId}*`);
        if (tenantKeys.length > 0) {
          await mainRedis.del(...tenantKeys);
        }
      }
    }

    // Cerrar todas las conexiones Redis
    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.quit();
        } catch {
          // ignorar si ya estaba cerrado
        }
      })
    );
  });

  async function setupTable(
    redis: Redis,
    tenantId: string,
    tableId: string,
    qrKey: string = 'valid-key'
  ): Promise<TableDTO & { qrKey: string }> {
    if (!createdTenants.includes(tenantId)) {
      createdTenants.push(tenantId);
    }
    const tableRepo = new RedisTableRepository(redis);
    const tableData: TableDTO & { qrKey: string } = {
      tableId,
      tenantId,
      label: `Table ${tableId}`,
      status: 'active',
      qrKey,
      createdAt: new Date().toISOString(),
    };
    await tableRepo.save(tenantId, tableData);
    return tableData;
  }

  test('1. Barrera determinista con dos instancias y clientes independientes: un solo ganador, sin huérfanos y tokens coherentes', async () => {
    const tenantId = `tenant-u7-barrier-${Date.now()}`;
    const tableId = 'tb-barrier-1';
    const qrKey = 'qr-barrier-key';

    const redis1 = createRedisClient();
    const redis2 = createRedisClient();

    await setupTable(redis1, tenantId, tableId, qrKey);

    class BarrierSessionRepo extends RedisTableSessionRepository {
      private hook?: () => Promise<void>;

      setHook(hook: () => Promise<void>) {
        this.hook = hook;
      }

      override async findActiveByTable(tId: string, tbId: string) {
        const result = await super.findActiveByTable(tId, tbId);
        if (this.hook) {
          await this.hook();
        }
        return result;
      }
    }

    const barrierRepo1 = new BarrierSessionRepo(redis1);
    const barrierRepo2 = new BarrierSessionRepo(redis2);
    const tableRepo1 = new RedisTableRepository(redis1);
    const tableRepo2 = new RedisTableRepository(redis2);

    const useCase1 = new OpenTableSessionUseCaseImpl(barrierRepo1, tableRepo1, tokenIssuer, 14400);
    const useCase2 = new OpenTableSessionUseCaseImpl(barrierRepo2, tableRepo2, tokenIssuer, 14400);

    // Barrera determinista: espera a que ambas instancias hayan evaluado findActiveByTable()
    let callersWaiting = 0;
    let releaseBarrier: () => void = () => {};
    const barrierPromise = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const syncBarrier = async () => {
      callersWaiting++;
      if (callersWaiting === 2) {
        releaseBarrier();
      } else {
        await barrierPromise;
      }
    };

    barrierRepo1.setHook(syncBarrier);
    barrierRepo2.setHook(syncBarrier);

    // Disparar ambas ejecuciones concurrentemente
    const [res1, res2] = await Promise.all([
      useCase1.execute({ tenantId, tableId, qrKey }),
      useCase2.execute({ tenantId, tableId, qrKey }),
    ]);

    // 1. Ambas devuelven exactamente el mismo sessionId ganador
    expect(res1.session.sessionId).toBe(res2.session.sessionId);
    const winnerSessionId = res1.session.sessionId;

    // 2. Ambos JWT tokens tienen el claim sessionId apuntando al mismo ganador
    const decodedToken1: any = jwt.verify(res1.guestToken, jwtSecret);
    const decodedToken2: any = jwt.verify(res2.guestToken, jwtSecret);
    expect(decodedToken1.sessionId).toBe(winnerSessionId);
    expect(decodedToken2.sessionId).toBe(winnerSessionId);

    // 3. Solo existe EXACTAMENTE 1 sesión activa en Redis (sin huérfano del candidato perdedor)
    const activeSessions = await barrierRepo1.listByTenant(tenantId, { status: 'active' });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].sessionId).toBe(winnerSessionId);

    // 4. El puntero de mesa apunta al ganador y los TTLs son coherentes y > 0
    const pointerKey = RedisKeys.tableSessionPointer(tenantId, tableId);
    const pointerValue = await redis1.get(pointerKey);
    expect(pointerValue).toBe(winnerSessionId);

    const pointerTtl = await redis1.ttl(pointerKey);
    const sessionTtl = await redis1.ttl(RedisKeys.session(winnerSessionId));
    expect(pointerTtl).toBeGreaterThan(0);
    expect(sessionTtl).toBeGreaterThan(0);
    // Deben tener TTLs cercanos (diferencia < 5 segundos)
    expect(Math.abs(pointerTtl - sessionTtl)).toBeLessThan(5);
  });

  test('2. Lote concurrente de 10 aperturas simultáneas para la misma mesa: un solo ganador e idempotencia total', async () => {
    const tenantId = `tenant-u7-batch-${Date.now()}`;
    const tableId = 'tb-batch-1';
    const qrKey = 'qr-batch-key';

    const redis = createRedisClient();
    await setupTable(redis, tenantId, tableId, qrKey);

    const sessionRepo = new RedisTableSessionRepository(redis);
    const tableRepo = new RedisTableRepository(redis);
    const useCase = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);

    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        useCase.execute({ tenantId, tableId, qrKey })
      )
    );

    const firstSessionId = results[0].session.sessionId;
    for (const res of results) {
      expect(res.session.sessionId).toBe(firstSessionId);
      const decoded: any = jwt.verify(res.guestToken, jwtSecret);
      expect(decoded.sessionId).toBe(firstSessionId);
    }

    const activeSessions = await sessionRepo.listByTenant(tenantId, { status: 'active' });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].sessionId).toBe(firstSessionId);
  });

  test('3. Distinto tenant o distinta mesa: aperturas concurrentes producen sesiones distintas sin interferencia', async () => {
    const tenantA = `tenant-u7-multiA-${Date.now()}`;
    const tenantB = `tenant-u7-multiB-${Date.now()}`;
    const table1 = 'tb-1';
    const table2 = 'tb-2';
    const qrKey = 'qr-multi-key';

    const redis = createRedisClient();
    await setupTable(redis, tenantA, table1, qrKey);
    await setupTable(redis, tenantA, table2, qrKey);
    await setupTable(redis, tenantB, table1, qrKey);

    const sessionRepo = new RedisTableSessionRepository(redis);
    const tableRepo = new RedisTableRepository(redis);
    const useCase = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);

    const [resA1, resA2, resB1] = await Promise.all([
      useCase.execute({ tenantId: tenantA, tableId: table1, qrKey }),
      useCase.execute({ tenantId: tenantA, tableId: table2, qrKey }),
      useCase.execute({ tenantId: tenantB, tableId: table1, qrKey }),
    ]);

    expect(resA1.session.sessionId).not.toBe(resA2.session.sessionId);
    expect(resA1.session.sessionId).not.toBe(resB1.session.sessionId);
    expect(resA2.session.sessionId).not.toBe(resB1.session.sessionId);

    const activeA = await sessionRepo.listByTenant(tenantA, { status: 'active' });
    expect(activeA).toHaveLength(2);

    const activeB = await sessionRepo.listByTenant(tenantB, { status: 'active' });
    expect(activeB).toHaveLength(1);
  });

  test('4. Cierre, reapertura y stale close: no borra puntero de sesión nueva ni touch resucita sesión cerrada', async () => {
    const tenantId = `tenant-u7-stale-${Date.now()}`;
    const tableId = 'tb-stale-1';
    const qrKey = 'qr-stale-key';

    const redis = createRedisClient();
    await setupTable(redis, tenantId, tableId, qrKey);

    const sessionRepo = new RedisTableSessionRepository(redis);
    const tableRepo = new RedisTableRepository(redis);
    const openUseCase = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);
    const closeUseCase = new CloseTableSessionUseCaseImpl(sessionRepo);

    // Paso 1: Abrir sesión S1
    const open1 = await openUseCase.execute({ tenantId, tableId, qrKey });
    const s1Id = open1.session.sessionId;

    // Paso 2: Cerrar S1
    const closedS1 = await closeUseCase.execute({ tenantId, sessionId: s1Id });
    expect(closedS1.status).toBe('closed');

    // Paso 3: Abrir nueva sesión S2 en la misma mesa
    const open2 = await openUseCase.execute({ tenantId, tableId, qrKey });
    const s2Id = open2.session.sessionId;
    expect(s2Id).not.toBe(s1Id);

    // Verificar que el puntero apunta a S2
    const activeAfterOpen2 = await sessionRepo.findActiveByTable(tenantId, tableId);
    expect(activeAfterOpen2).not.toBeNull();
    expect(activeAfterOpen2!.sessionId).toBe(s2Id);

    // Paso 4: Reintentar close sobre S1 (stale close repetido / desfasado)
    // Probamos tanto el caso del caso de uso como invocación directa del repo (worker/retry)
    const reClosedS1 = await closeUseCase.execute({ tenantId, sessionId: s1Id });
    expect(reClosedS1.status).toBe('closed');

    // Invocación directa a nivel de repositorio (ej. worker de limpieza o reintento atrasado)
    await sessionRepo.close(tenantId, s1Id, new Date());

    // CRÍTICO: El puntero de S2 NO debió ser borrado por el close de S1
    const activeAfterStaleClose = await sessionRepo.findActiveByTable(tenantId, tableId);
    expect(activeAfterStaleClose).not.toBeNull();
    expect(activeAfterStaleClose!.sessionId).toBe(s2Id);

    // Paso 5: Llamar a touch sobre S1 cerrada
    await sessionRepo.touch(tenantId, s1Id, 14400);

    // S1 NO debe ser resucitada a active
    const s1AfterTouch = await sessionRepo.findById(tenantId, s1Id);
    expect(s1AfterTouch!.status).toBe('closed');

    // El puntero de la mesa debe seguir apuntando a S2
    const activeAfterTouch = await sessionRepo.findActiveByTable(tenantId, tableId);
    expect(activeAfterTouch).not.toBeNull();
    expect(activeAfterTouch!.sessionId).toBe(s2Id);
  });
});
