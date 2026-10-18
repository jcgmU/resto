import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { closeDefaultAppConnections } from '../../src/app';

export const TEST_ORDERING_DATABASE_URL =
  process.env.ORDERING_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/resto_ordering_test?schema=public';

export const TEST_ORDERING_REDIS_URL =
  process.env.REDIS_URL || 'redis://localhost:6379/3';

process.env.ORDERING_DATABASE_URL = TEST_ORDERING_DATABASE_URL;
process.env.REDIS_URL = TEST_ORDERING_REDIS_URL;

let prismaClient: PrismaClient | null = null;
let redisClient: Redis | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: TEST_ORDERING_DATABASE_URL,
        },
      },
    });
  }
  return prismaClient;
}

export function getTestRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(TEST_ORDERING_REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 50, 500);
      },
    });
  }
  return redisClient;
}

export async function ensureContractEnv(): Promise<void> {
  const prisma = getTestPrisma();
  const redis = getTestRedis();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    throw new Error(
      `[TEST-CONTRATO] Error conectando a Postgres en ${TEST_ORDERING_DATABASE_URL}. ` +
      `El stack Docker debe estar corriendo con la base de datos resto_ordering_test lista. ` +
      `Ejecute: docker compose up -d. Detalle: ${err.message}`
    );
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Respuesta inesperada de Redis: ${pong}`);
    }
  } catch (err: any) {
    throw new Error(
      `[TEST-CONTRATO] Error conectando a Redis en ${TEST_ORDERING_REDIS_URL}. ` +
      `El stack Docker debe estar corriendo. Ejecute: docker compose up -d. Detalle: ${err.message}`
    );
  }
}

export async function truncateOrderingDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OrderStatusEvent", "OrderItemModifier", "OrderItem", "Order", "Payment" CASCADE;'
  );
}

export async function flushOrderingRedis(): Promise<void> {
  const redis = getTestRedis();
  await redis.flushdb();
}

export async function disconnectTestInfra(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect().catch(() => {});
    prismaClient = null;
  }
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  await closeDefaultAppConnections();
}
