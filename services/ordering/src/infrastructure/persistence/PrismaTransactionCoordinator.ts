import { PrismaClient } from '@prisma/client';
import { TransactionCoordinator } from '../../application/ports/TransactionCoordinator';

export class PrismaTransactionCoordinator implements TransactionCoordinator {
  constructor(private readonly prisma: PrismaClient) {}

  async runInSessionLock<T>(
    tenantId: string,
    sessionId: string,
    fn: (tx: any) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // En PostgreSQL, pg_advisory_xact_lock serializa concurrentemente por hash(tenantId, sessionId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${sessionId}))`;
        return fn(tx);
      },
      {
        timeout: 15000,
        maxWait: 10000,
      }
    );
  }
}
