import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

describe('Ordering Real Database and Redis Connection', () => {
  let prisma: PrismaClient;
  let redis: Redis;

  beforeAll(async () => {
    const dbUrl = process.env.ORDERING_DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        'Missing required env ORDERING_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'Missing required env REDIS_URL for test:real (refusing to fall back to dev Redis)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    await prisma.$connect();

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (redis) {
      await redis.quit();
    }
  });

  it('connects to real isolated PostgreSQL database and can query orders', async () => {
    const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(Number(result[0].result)).toBe(1);

    const orders = await prisma.order.findMany();
    expect(Array.isArray(orders)).toBe(true);
  });

  it('connects to real isolated Redis db1 and verifies isolation', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');

    const testKey = `test:harness:ordering:${Date.now()}`;
    await redis.set(testKey, 'ordering-active', 'EX', 10);
    const val = await redis.get(testKey);
    expect(val).toBe('ordering-active');
    await redis.del(testKey);
  });
});
