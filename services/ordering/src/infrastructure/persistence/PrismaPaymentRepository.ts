import { PrismaClient } from '@prisma/client';
import { PaymentDTO, PaymentMethod, PaymentRepository } from '@packages/shared-types';

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDTO(record: any): PaymentDTO {
    return {
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      tableId: record.tableId,
      amount: Number(record.amount),
      method: record.method as PaymentMethod,
      ordersCount: record.ordersCount,
      recordedBy: record.recordedBy,
      createdAt:
        record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    };
  }

  async save(tenantId: string, payment: PaymentDTO, tx?: any): Promise<PaymentDTO> {
    const client = tx || this.prisma;
    try {
      const created = await client.payment.create({
        data: {
          id: payment.id,
          tenantId,
          sessionId: payment.sessionId,
          tableId: payment.tableId,
          amount: payment.amount,
          method: payment.method as any,
          ordersCount: payment.ordersCount,
          recordedBy: payment.recordedBy,
          createdAt: payment.createdAt ? new Date(payment.createdAt) : undefined,
        },
      });
      return this.mapToDTO(created);
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        const existing = await this.findBySession(tenantId, payment.sessionId, tx);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async findBySession(tenantId: string, sessionId: string, tx?: any): Promise<PaymentDTO | null> {
    const client = tx || this.prisma;
    const found = await client.payment.findUnique({
      where: {
        tenantId_sessionId: {
          tenantId,
          sessionId,
        },
      },
    });

    if (!found) {
      return null;
    }
    return this.mapToDTO(found);
  }
}
