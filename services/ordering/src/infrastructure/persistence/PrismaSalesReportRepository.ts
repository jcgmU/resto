import { PrismaClient } from '@prisma/client';
import { SalesReportPort } from '../../application/ports/SalesReportPort';

export class PrismaSalesReportRepository implements SalesReportPort {
  constructor(private readonly prisma: PrismaClient) {}

  async sumPaymentsBetween(tenantId: string, from: Date, to: Date): Promise<{ total: string; tickets: number }> {
    const result = await this.prisma.payment.aggregate({
      where: { tenantId, createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return { total: result._sum.amount?.toString() ?? '0', tickets: result._count._all };
  }
}
