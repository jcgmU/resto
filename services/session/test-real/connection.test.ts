import Redis from 'ioredis';

describe('Session Real Redis Connection', () => {
  let redis: Redis;

  beforeAll(() => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'Missing required env REDIS_URL for test:real (refusing to fall back to dev Redis)'
      );
    }
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  it('connects to real isolated Redis db0 and responds to PING and basic key ops', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');

    const testKey = `test:harness:session:${Date.now()}`;
    await redis.set(testKey, 'ok', 'EX', 10);
    const value = await redis.get(testKey);
    expect(value).toBe('ok');
    await redis.del(testKey);
  });
});
