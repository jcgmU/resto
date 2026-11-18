import {
  ensureContractEnv,
  getTestPrisma,
  disconnectTestPrisma,
} from './contract-helper';

describe('Identity Contract Infra (Postgres Real)', () => {
  beforeAll(async () => {
    await ensureContractEnv();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('debe ejecutar SELECT 1 contra la base de datos resto_identity_test real', async () => {
    const prisma = getTestPrisma();
    const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe(1);
  });
});
