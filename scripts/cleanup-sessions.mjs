#!/usr/bin/env node

/**
 * cleanup-sessions.mjs - Limpieza de sesiones duplicadas u huérfanas en Redis
 * 
 * Requisitos:
 * - Compatible con Node 20+
 * - Lee REDIS_URL de entorno (default: redis://localhost:6379)
 * - Identifica sesiones huérfanas en sets de tenant
 * - Detecta múltiples sesiones activas para la misma mesa y conserva únicamente
 *   la referenciada por el puntero activo (o la más reciente si no hay puntero),
 *   cerrando y limpiando las duplicadas
 * - Limpia punteros huérfanos/caducados
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let Redis;
try {
  Redis = (await import('ioredis')).default;
} catch {
  try {
    const sessionRequire = createRequire(new URL('../services/session/package.json', import.meta.url));
    Redis = sessionRequire('ioredis');
  } catch {
    const orderingRequire = createRequire(new URL('../services/ordering/package.json', import.meta.url));
    Redis = orderingRequire('ioredis');
  }
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function runCleanup() {
  console.log('====================================================');
  console.log('🔄 Iniciando scripts/cleanup-sessions.mjs');
  console.log(`🔌 Conectando a Redis: ${REDIS_URL}`);
  console.log('====================================================');

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Respuesta inesperada de Redis: ${pong}`);
    }
  } catch (err) {
    console.error(`❌ Error conectando a Redis en ${REDIS_URL}:`, err.message);
    process.exit(1);
  }

  const stats = {
    tenantsScanned: 0,
    totalSessionsFound: 0,
    activeSessionsKept: 0,
    closedSessionsKept: 0,
    duplicateSessionsClosed: 0,
    orphanSetMembersRemoved: 0,
    stalePointersRemoved: 0,
    pointersRepaired: 0,
  };

  try {
    // 1. Descubrir todos los tenants en Redis
    const tenantSetKeys = await redis.keys('tenant:*:sessions');
    const tablePointerKeys = await redis.keys('tenant:*:table:*:session');
    const tenantTableKeys = await redis.keys('tenant:*:tables');

    const tenantIds = new Set();

    for (const key of tenantSetKeys) {
      const match = key.match(/^tenant:([^:]+):sessions$/);
      if (match) tenantIds.add(match[1]);
    }
    for (const key of tablePointerKeys) {
      const match = key.match(/^tenant:([^:]+):table:/);
      if (match) tenantIds.add(match[1]);
    }
    for (const key of tenantTableKeys) {
      const match = key.match(/^tenant:([^:]+):tables$/);
      if (match) tenantIds.add(match[1]);
    }

    // Si no hay keys con prefijo tenant, buscar sesiones sueltas
    const allSessionKeys = await redis.keys('session:*');
    for (const sessionKey of allSessionKeys) {
      try {
        const raw = await redis.get(sessionKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.tenantId) {
            tenantIds.add(parsed.tenantId);
          }
        }
      } catch {
        // Ignorar claves no JSON
      }
    }

    stats.tenantsScanned = tenantIds.size;
    console.log(`📊 Tenants detectados (${stats.tenantsScanned}): ${Array.from(tenantIds).join(', ') || 'ninguno'}`);

    for (const tenantId of tenantIds) {
      console.log(`\n🏢 Procesando tenant: ${tenantId}`);
      const setKey = `tenant:${tenantId}:sessions`;
      const sessionIds = await redis.smembers(setKey);

      // Mapear todas las sesiones del tenant
      const validSessions = [];

      for (const sessionId of sessionIds) {
        const sessionKey = `session:${sessionId}`;
        const raw = await redis.get(sessionKey);

        if (!raw) {
          // Sesión huérfana en el set sin clave session:{id} correspondiente
          console.log(`  🧹 Removiendo ID huérfano de ${setKey}: ${sessionId}`);
          await redis.srem(setKey, sessionId);
          stats.orphanSetMembersRemoved++;
          continue;
        }

        try {
          const session = JSON.parse(raw);
          if (session.tenantId !== tenantId) {
            console.log(`  ⚠️ Sesión ${sessionId} pertenece a otro tenant (${session.tenantId}), quitando de ${setKey}`);
            await redis.srem(setKey, sessionId);
            stats.orphanSetMembersRemoved++;
            continue;
          }
          validSessions.push(session);
          stats.totalSessionsFound++;
        } catch (e) {
          console.warn(`  ⚠️ Error parseando JSON de ${sessionKey}:`, e.message);
        }
      }

      // Agrupar sesiones por mesa (tableId)
      const sessionsByTable = new Map();
      for (const session of validSessions) {
        const tableId = session.tableId || 'unknown';
        if (!sessionsByTable.has(tableId)) {
          sessionsByTable.set(tableId, []);
        }
        sessionsByTable.get(tableId).push(session);
      }

      // Procesar cada mesa
      for (const [tableId, sessions] of sessionsByTable.entries()) {
        const pointerKey = `tenant:${tenantId}:table:${tableId}:session`;
        const activePointerSessionId = await redis.get(pointerKey);

        const activeSessions = sessions.filter((s) => s.status === 'active');
        const closedSessions = sessions.filter((s) => s.status === 'closed');

        stats.closedSessionsKept += closedSessions.length;

        if (activeSessions.length === 0) {
          // No hay sesiones activas. Si el puntero aún apunta a algo, es un puntero obsoleto
          if (activePointerSessionId) {
            console.log(`  🧹 Mesa ${tableId}: puntero obsoleto apunta a ${activePointerSessionId} sin sesión activa. Eliminando puntero.`);
            await redis.del(pointerKey);
            stats.stalePointersRemoved++;
          }
        } else if (activeSessions.length === 1) {
          const canonical = activeSessions[0];
          stats.activeSessionsKept++;

          // Asegurar que el puntero coincida
          if (activePointerSessionId !== canonical.sessionId) {
            console.log(`  🔧 Mesa ${tableId}: corrigiendo puntero a sesión activa única ${canonical.sessionId} (anterior: ${activePointerSessionId || 'ninguno'})`);
            await redis.set(pointerKey, canonical.sessionId, 'EX', 14400);
            stats.pointersRepaired++;
          }
        } else {
          // DUPLICADOS: múltiples sesiones activas para la misma mesa
          console.log(`  ⚠️ Mesa ${tableId}: detectadas ${activeSessions.length} sesiones activas concurrentes.`);

          // Conservar la que coincide con el puntero activo, o la más reciente
          let canonical = activeSessions.find((s) => s.sessionId === activePointerSessionId);
          if (!canonical) {
            // Ordenar por fecha de creación descendente (más reciente)
            activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            canonical = activeSessions[0];
            console.log(`    Puntero activo no coincidía con ninguna. Se elige la más reciente como canónica: ${canonical.sessionId}`);
            await redis.set(pointerKey, canonical.sessionId, 'EX', 14400);
            stats.pointersRepaired++;
          } else {
            console.log(`    Se conserva la sesión canónica apuntada por el puntero: ${canonical.sessionId}`);
          }

          stats.activeSessionsKept++;

          // Cerrar y limpiar las demás sesiones duplicadas
          for (const duplicate of activeSessions) {
            if (duplicate.sessionId === canonical.sessionId) continue;

            duplicate.status = 'closed';
            duplicate.closedAt = new Date().toISOString();
            const sessionKey = `session:${duplicate.sessionId}`;

            // Persistir estado cerrado con TTL de 24h (86400s)
            await redis.set(sessionKey, JSON.stringify(duplicate), 'EX', 86400);
            console.log(`    🔒 Cerrada sesión duplicada ${duplicate.sessionId} de mesa ${tableId}`);
            stats.duplicateSessionsClosed++;
          }
        }
      }

      // Verificar punteros huérfanos de mesas que no tengan ninguna sesión en la lista
      const tenantPointers = await redis.keys(`tenant:${tenantId}:table:*:session`);
      for (const ptrKey of tenantPointers) {
        const ptrMatch = ptrKey.match(/^tenant:[^:]+:table:([^:]+):session$/);
        if (ptrMatch) {
          const tId = ptrMatch[1];
          if (!sessionsByTable.has(tId)) {
            const ptrVal = await redis.get(ptrKey);
            const refRaw = ptrVal ? await redis.get(`session:${ptrVal}`) : null;
            if (!refRaw) {
              console.log(`  🧹 Mesa ${tId}: puntero sin sesiones registradas. Eliminando ${ptrKey}`);
              await redis.del(ptrKey);
              stats.stalePointersRemoved++;
            }
          }
        }
      }
    }

    console.log('\n====================================================');
    console.log('✅ Resumen de ejecución de scripts/cleanup-sessions.mjs:');
    console.log(`- Tenants examinados:                 ${stats.tenantsScanned}`);
    console.log(`- Sesiones totales encontradas:        ${stats.totalSessionsFound}`);
    console.log(`- Sesiones activas conservadas:       ${stats.activeSessionsKept}`);
    console.log(`- Sesiones cerradas conservadas:      ${stats.closedSessionsKept}`);
    console.log(`- Sesiones duplicadas cerradas:       ${stats.duplicateSessionsClosed}`);
    console.log(`- IDs huérfanos removidos de sets:    ${stats.orphanSetMembersRemoved}`);
    console.log(`- Punteros reparados:                 ${stats.pointersRepaired}`);
    console.log(`- Punteros obsoletos eliminados:      ${stats.stalePointersRemoved}`);
    console.log('====================================================');

    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la limpieza de sesiones:', err);
    await redis.quit();
    process.exit(1);
  }
}

runCleanup();
