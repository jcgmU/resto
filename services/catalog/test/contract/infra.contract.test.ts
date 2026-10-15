import {
  ensureContractEnv,
  getTestPrisma,
  disconnectTestPrisma,
} from './contract-helper';

describe('Catalog Contract Infra (Postgres Real)', () => {
  beforeAll(async () => {
    await ensureContractEnv();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('debe ejecutar SELECT 1 contra la base de datos resto_catalog_test real', async () => {
    const prisma = getTestPrisma();
    const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe(1);
  });

  it('debe rechazar Product con price negativo a nivel base de datos (CHECK product_price_check)', async () => {
    const prisma = getTestPrisma();
    const cat = await prisma.category.create({
      data: {
        tenantId: 't-chk-test',
        name: 'Cat Test ' + Date.now(),
      },
    });

    await expect(
      prisma.product.create({
        data: {
          tenantId: 't-chk-test',
          categoryId: cat.id,
          name: 'Prod Negativo',
          price: -5,
        },
      })
    ).rejects.toThrow();
  });
});
