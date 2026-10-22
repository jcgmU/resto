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
      invoiceStatus: (record.invoiceStatus as any) || 'none',
      invoiceRef: record.invoiceRef ?? undefined,
      invoiceError: record.invoiceError ?? undefined,
    };
  }

  async save(tenantId: string, payment: PaymentDTO): Promise<PaymentDTO> {
    try {
      const created = await this.prisma.payment.create({
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
          invoiceStatus: payment.invoiceStatus || 'none',
          invoiceRef: payment.invoiceRef ?? null,
          invoiceError: payment.invoiceError ?? null,
        },
      });
      return this.mapToDTO(created);
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        const existing = await this.findBySession(tenantId, payment.sessionId);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async findBySession(tenantId: string, sessionId: string): Promise<PaymentDTO | null> {
    const found = await this.prisma.payment.findUnique({
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
