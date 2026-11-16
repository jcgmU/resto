import { PrismaClient } from '../src/generated/client';

describe('Catalog Real Database Connection', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const url = process.env.CATALOG_DATABASE_URL;
    if (!url) {
      throw new Error(
        'Missing required env CATALOG_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url },
      },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('connects to real isolated PostgreSQL database and can query categories', async () => {
    const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(Number(result[0].result)).toBe(1);

    const categories = await prisma.category.findMany();
    expect(Array.isArray(categories)).toBe(true);
  });
});
