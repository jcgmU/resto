import {
  ensureContractEnv,
  getTestRedis,
  flushSessionRedis,
  disconnectTestRedis,
} from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import {
  OpenTableSessionUseCaseImpl,
  CloseTableSessionUseCaseImpl,
} from '../../src/application/SessionUseCases';
import { JwtGuestTokenIssuer } from '../../src/infrastructure/security/JwtGuestTokenIssuer';
import { createSessionApp } from '../../src/app';
import request from 'supertest';
import { TableSessionDTO } from '@packages/shared-types';

describe('R04 Sesión Atómica (Contract Test con Redis Real db2)', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let tokenIssuer: JwtGuestTokenIssuer;
  let openUseCase: OpenTableSessionUseCaseImpl;
  let closeUseCase: CloseTableSessionUseCaseImpl;
  let app: any;

  const tenantId = 'tenant-atomic-test';
  const tableId = 'table-atomic-1';
  const qrKey = 'valid-atomic-qr-key';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    tokenIssuer = new JwtGuestTokenIssuer('contract-test-secret');

    openUseCase = new OpenTableSessionUseCaseImpl(sessionRepo, tableRepo, tokenIssuer, 14400);
    closeUseCase = new CloseTableSessionUseCaseImpl(sessionRepo);

    app = createSessionApp({
      tableRepo,
      sessionRepo,
    });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();

    // Crear mesa activa para pruebas
    await tableRepo.save(tenantId, {
      tableId,
      tenantId,
      label: 'Mesa Atómica 1',
      status: 'active',
      qrKey,
      createdAt: new Date().toISOString(),
    });
  });

  test('8 aperturas concurrentes (Promise.all) devuelven el mismo sessionId y crean exactamente 1 sesión en Redis', async () => {
    // Disparar 8 aperturas concurrentes con Promise.all
    const promises = Array.from({ length: 8 }).map(() =>
      openUseCase.execute({ tenantId, tableId, qrKey })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(8);

    const firstSessionId = results[0].session.sessionId;
    expect(firstSessionId).toBeDefined();

    // Verificar que TODAS las 8 llamadas devolvieron exactamente el mismo sessionId
    for (const res of results) {
      expect(res.session.sessionId).toBe(firstSessionId);
      expect(res.session.status).toBe('active');
      expect(res.session.tableId).toBe(tableId);
      expect(res.guestToken).toBeDefined();
    }

    // Verificar en Redis:
    // 1. Puntero mesa-sesión apunta a la sesión única
    const pointerKey = `tenant:${tenantId}:table:${tableId}:session`;
    const pointerValue = await redis.get(pointerKey);
    expect(pointerValue).toBe(firstSessionId);

    // 2. Set tenant:{t}:sessions contiene exactamente 1 sesión
    const setKey = `tenant:${tenantId}:sessions`;
    const sessionIdsInSet = await redis.smembers(setKey);
    expect(sessionIdsInSet).toEqual([firstSessionId]);

    // 3. listByTenant con filtro active devuelve solo 1 sesión
    const activeSessions = await sessionRepo.listByTenant(tenantId, {
      status: 'active',
      tableId,
    });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].sessionId).toBe(firstSessionId);
  });

  test('8 aperturas x 3 tandas concurrentes conservan la misma sesión única (8x3 = 1 sesión)', async () => {
    // Tanda 1
    const batch1 = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        openUseCase.execute({ tenantId, tableId, qrKey })
      )
    );
    const initialSessionId = batch1[0].session.sessionId;

    // Tanda 2
    const batch2 = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        openUseCase.execute({ tenantId, tableId, qrKey })
      )
    );

    // Tanda 3
    const batch3 = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        openUseCase.execute({ tenantId, tableId, qrKey })
      )
    );

    const allResults = [...batch1, ...batch2, ...batch3];
    expect(allResults).toHaveLength(24);

    for (const res of allResults) {
      expect(res.session.sessionId).toBe(initialSessionId);
    }

    const sessionIdsInSet = await redis.smembers(`tenant:${tenantId}:sessions`);
    expect(sessionIdsInSet).toEqual([initialSessionId]);
  });

  test('8 peticiones HTTP concurrentes (POST /sessions/open) devuelven el mismo sessionId', async () => {
    const promises = Array.from({ length: 8 }).map(() =>
      request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey })
    );

    const responses = await Promise.all(promises);
    expect(responses).toHaveLength(8);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
    }

    const expectedSessionId = responses[0].body.session.sessionId;
    for (const res of responses) {
      expect(res.body.session.sessionId).toBe(expectedSessionId);
    }

    const sessionIdsInSet = await redis.smembers(`tenant:${tenantId}:sessions`);
    expect(sessionIdsInSet).toEqual([expectedSessionId]);
  });

  test('getOrCreateActive a nivel repositorio con 8 candidatos concurrentes resuelve a un único candidato ganador', async () => {
    // Generar 8 candidatos con IDs diferentes
    const candidates: TableSessionDTO[] = Array.from({ length: 8 }).map((_, i) => ({
      sessionId: `candidate-session-${i}-${Date.now()}`,
      tenantId,
      tableId,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14400 * 1000).toISOString(),
    }));

    // Ejecutar getOrCreateActive concurrentemente
    const results = await Promise.all(
      candidates.map((cand) =>
        (sessionRepo as any).getOrCreateActive(tenantId, tableId, cand, 14400)
      )
    );

    const winnerSessionId = results[0].sessionId;
    expect(candidates.map((c) => c.sessionId)).toContain(winnerSessionId);

    for (const res of results) {
      expect(res.sessionId).toBe(winnerSessionId);
      expect(res.status).toBe('active');
    }

    // Verificar en Redis que solo el ganador quedó registrado
    const sessionIdsInSet = await redis.smembers(`tenant:${tenantId}:sessions`);
    expect(sessionIdsInSet).toEqual([winnerSessionId]);

    const pointer = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointer).toBe(winnerSessionId);
  });

  test('Tras cerrar la sesión activa, una nueva tanda de 8 aperturas concurrentes crea exactamente 1 nueva sesión activa', async () => {
    // Abrir sesión inicial
    const initial = await openUseCase.execute({ tenantId, tableId, qrKey });
    const firstSessionId = initial.session.sessionId;

    // Cerrar sesión
    await closeUseCase.execute({ tenantId, sessionId: firstSessionId });

    // Verificar que el puntero se eliminó
    const pointerAfterClose = await redis.get(`tenant:${tenantId}:table:${tableId}:session`);
    expect(pointerAfterClose).toBeNull();

    // Nueva tanda de 8 aperturas concurrentes
    const batch2 = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        openUseCase.execute({ tenantId, tableId, qrKey })
      )
    );

    const secondSessionId = batch2[0].session.sessionId;
    expect(secondSessionId).not.toBe(firstSessionId);

    for (const res of batch2) {
      expect(res.session.sessionId).toBe(secondSessionId);
    }

    // En Redis hay exactamente 2 sesiones en el set (la cerrada y la nueva activa)
    const sessionIdsInSet = await redis.smembers(`tenant:${tenantId}:sessions`);
    expect(sessionIdsInSet.sort()).toEqual([firstSessionId, secondSessionId].sort());

    // Pero solo 1 sesión activa para la mesa
    const activeSessions = await sessionRepo.listByTenant(tenantId, {
      status: 'active',
      tableId,
    });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].sessionId).toBe(secondSessionId);
  });
});
