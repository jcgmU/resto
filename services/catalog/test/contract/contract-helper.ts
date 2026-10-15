import { PrismaClient } from '../../src/generated/client';

export const TEST_CATALOG_DATABASE_URL =
  process.env.CATALOG_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/resto_catalog_test?schema=public';

process.env.CATALOG_DATABASE_URL = TEST_CATALOG_DATABASE_URL;

let prismaClient: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CATALOG_DATABASE_URL,
        },
      },
    });
  }
  return prismaClient;
}

export async function ensureContractEnv(): Promise<void> {
  const prisma = getTestPrisma();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    throw new Error(
      `[TEST-CONTRATO] Error conectando a Postgres en ${TEST_CATALOG_DATABASE_URL}. ` +
      `El stack Docker debe estar corriendo con la base de datos resto_catalog_test lista. ` +
      `Ejecute: docker compose up -d. Detalle: ${err.message}`
    );
  }
}

export async function truncateCatalogDb(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ProductModifierGroup", "ModifierOption", "ModifierGroup", "Product", "Category" CASCADE;'
  );
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
