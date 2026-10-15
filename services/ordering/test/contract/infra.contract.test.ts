import {
  ensureContractEnv,
  getTestPrisma,
  getTestRedis,
  disconnectTestInfra,
} from './contract-helper';

describe('Ordering Contract Infra (Postgres Real & Redis db3)', () => {
  beforeAll(async () => {
    await ensureContractEnv();
  });

  afterAll(async () => {
    await disconnectTestInfra();
  });

  it('debe ejecutar SELECT 1 contra Postgres resto_ordering_test y PING contra Redis db3', async () => {
    const prisma = getTestPrisma();
    const redis = getTestRedis();

    const pgResult = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(pgResult).toHaveLength(1);
    expect(pgResult[0].result).toBe(1);

    const redisResult = await redis.ping();
    expect(redisResult).toBe('PONG');
  });
});
