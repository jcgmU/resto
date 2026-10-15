import Redis from 'ioredis';

export const TEST_SESSION_REDIS_URL =
  process.env.REDIS_URL || 'redis://localhost:6379/2';

process.env.REDIS_URL = TEST_SESSION_REDIS_URL;

let redisClient: Redis | null = null;

export function getTestRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(TEST_SESSION_REDIS_URL, {
      maxRetriesPerRequest: 1,
    });
  }
  return redisClient;
}

export async function ensureContractEnv(): Promise<void> {
  const redis = getTestRedis();
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Respuesta inesperada de Redis: ${pong}`);
    }
  } catch (err: any) {
    throw new Error(
      `[TEST-CONTRATO] Error conectando a Redis en ${TEST_SESSION_REDIS_URL}. ` +
      `El stack Docker debe estar corriendo. Ejecute: docker compose up -d. Detalle: ${err.message}`
    );
  }
}

export async function flushSessionRedis(): Promise<void> {
  const redis = getTestRedis();
  await redis.flushdb();
}

export async function disconnectTestRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
