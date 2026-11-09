import { PrismaClient } from '../src/generated/client';

describe('Identity Real Database Connection', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const url = process.env.IDENTITY_DATABASE_URL;
    if (!url) {
      throw new Error(
        'Missing required env IDENTITY_DATABASE_URL for test:real (refusing to fall back to dev database)'
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

  it('connects to real isolated PostgreSQL database and can query tenants', async () => {
    const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(Number(result[0].result)).toBe(1);

    const tenants = await prisma.tenant.findMany();
    expect(Array.isArray(tenants)).toBe(true);
  });
});
