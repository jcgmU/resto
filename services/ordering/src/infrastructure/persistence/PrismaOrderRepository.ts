import { PrismaClient } from '@prisma/client';
import {
  OrderDTO,
  OrderItemDTO,
  OrderModifierDTO,
  OrderRepository,
  OrderStatus,
} from '@packages/shared-types';
import {
  OrderReservationFencePort,
  ReservationFenceStatus,
} from '../../application/ports/CartReservationPort';

export class PrismaOrderRepository implements OrderRepository, OrderReservationFencePort {
  private fenceTablePromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  private async ensureFenceTable(): Promise<void> {
    if (!this.fenceTablePromise) {
      this.fenceTablePromise = (async () => {
        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "cart_reservation_fences" (
            "operation_id" TEXT PRIMARY KEY,
            "tenant_id" TEXT NOT NULL,
            "session_id" TEXT NOT NULL,
            "order_id" TEXT NOT NULL,
            "status" TEXT NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      })();
    }
    await this.fenceTablePromise;
  }

  private mapToDTO(record: any): OrderDTO {
    const items: OrderItemDTO[] = (record.items || []).map((item: any) => {
      const modifiers: OrderModifierDTO[] = (item.modifiers || []).map((mod: any) => ({
        groupId: mod.groupId,
        groupName: mod.groupName,
        optionId: mod.optionId,
        optionName: mod.optionName,
        priceDelta: Number(mod.priceDelta),
      }));

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        notes: item.notes,
        modifiers,
      };
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      tableId: record.tableId,
      status: record.status,
      total: Number(record.total),
      items,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      cancelledAt: record.cancelledAt
        ? record.cancelledAt instanceof Date
          ? record.cancelledAt.toISOString()
          : record.cancelledAt
        : undefined,
    };
  }

  async save(tenantId: string, order: OrderDTO, tx?: any): Promise<OrderDTO> {
    const run = async (client: any) => {
      const created = await client.order.create({
        data: {
          id: order.id,
          tenantId,
          sessionId: order.sessionId,
          tableId: order.tableId,
          status: order.status as any,
          total: order.total,
          items: {
            create: order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              notes: item.notes,
              modifiers: {
                create: (item.modifiers || []).map((mod) => ({
                  groupId: mod.groupId,
                  groupName: mod.groupName,
                  optionId: mod.optionId,
                  optionName: mod.optionName,
                  priceDelta: mod.priceDelta,
                })),
              },
            })),
          },
        },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      });

      return this.mapToDTO(created);
    };

    if (tx) {
      return run(tx);
    }
    return this.prisma.$transaction(run);
  }

  async findById(tenantId: string, id: string, tx?: any): Promise<OrderDTO | null> {
    const client = tx || this.prisma;
    const record = await client.order.findFirst({
      where: { tenantId, id },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return record ? this.mapToDTO(record) : null;
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'PLACED' | 'CANCELLED'; tableId?: string }
  ): Promise<OrderDTO[]> {
    const records = await this.prisma.order.findMany({
      where: {
        tenantId,
        ...(filter?.status ? { status: filter.status as any } : {}),
        ...(filter?.tableId ? { tableId: filter.tableId } : {}),
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToDTO(r));
  }

  async listBySession(tenantId: string, sessionId: string, tx?: any): Promise<OrderDTO[]> {
    const client = tx || this.prisma;
    const records = await client.order.findMany({
      where: { tenantId, sessionId },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r: any) => this.mapToDTO(r));
  }

  async cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt,
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    updatedAt: Date
  ): Promise<OrderDTO> {
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        updatedAt,
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    return this.mapToDTO(updated);
  }

  async claimReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    tx?: any
  ): Promise<ReservationFenceStatus> {
    const client = tx || this.prisma;
    await this.ensureFenceTable();

    await client.$executeRawUnsafe(
      `INSERT INTO "cart_reservation_fences" ("operation_id", "tenant_id", "session_id", "order_id", "status")
       VALUES ($1, $2, $3, $4, 'COMMITTED')
       ON CONFLICT ("operation_id") DO NOTHING`,
      operationId,
      tenantId,
      sessionId,
      orderId
    );

    const rows: any[] = await client.$queryRawUnsafe(
      `SELECT "status" FROM "cart_reservation_fences"
       WHERE "operation_id" = $1 AND "tenant_id" = $2 AND "session_id" = $3`,
      operationId,
      tenantId,
      sessionId
    );

    if (rows.length > 0 && rows[0].status === 'ABORTED') {
      return 'ABORTED';
    }
    return 'COMMITTED';
  }

  async abortReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    tx?: any
  ): Promise<ReservationFenceStatus> {
    const client = tx || this.prisma;
    await this.ensureFenceTable();

    const existing = await this.findById(tenantId, orderId, client);
    if (existing) {
      return 'COMMITTED';
    }

    await client.$executeRawUnsafe(
      `INSERT INTO "cart_reservation_fences" ("operation_id", "tenant_id", "session_id", "order_id", "status")
       VALUES ($1, $2, $3, $4, 'ABORTED')
       ON CONFLICT ("operation_id") DO NOTHING`,
      operationId,
      tenantId,
      sessionId,
      orderId
    );

    const rows: any[] = await client.$queryRawUnsafe(
      `SELECT "status" FROM "cart_reservation_fences"
       WHERE "operation_id" = $1 AND "tenant_id" = $2 AND "session_id" = $3`,
      operationId,
      tenantId,
      sessionId
    );

    if (rows.length > 0 && rows[0].status === 'COMMITTED') {
      return 'COMMITTED';
    }
    return 'ABORTED';
  }
}
