import crypto from 'crypto';
import { PrismaClient } from '../../src/generated/client';

export const TEST_CATALOG_DATABASE_URL =
  process.env.CATALOG_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/resto_catalog_test?schema=public';

process.env.CATALOG_DATABASE_URL = TEST_CATALOG_DATABASE_URL;

export const TEST_JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-hardening-test';
process.env.JWT_SECRET = TEST_JWT_SECRET;

export function signContractJwt(payload: {
  tenantId?: string;
  role?: string;
  userId?: string;
  sessionId?: string;
  exp?: number;
  [key: string]: any;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TEST_JWT_SECRET)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

export function getContractAuthHeaders(tenantId: string, role?: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-tenant-id': tenantId };
  if (role) {
    headers['x-user-role'] = role;
    headers['Authorization'] = `Bearer ${signContractJwt({ tenantId, role })}`;
  }
  return headers;
}

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
