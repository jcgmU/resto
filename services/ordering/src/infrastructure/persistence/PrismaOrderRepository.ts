import { PrismaClient } from '@prisma/client';
import {
  OrderDTO,
  OrderHistoryEventDTO,
  OrderItemDTO,
  OrderModifierDTO,
  OrderRepository,
  OrderStatus,
  computeOrderOverdue,
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
        notes: item.notes ?? undefined,
        destination: (item.destination as 'kitchen' | 'bar') || 'kitchen',
        modifiers,
      };
    });

    const delayMinutes = Number(record.delayMinutes ?? 0);
    const estimatedMinutes =
      record.estimatedMinutes != null ? Number(record.estimatedMinutes) : undefined;
    const notes = record.notes ?? undefined;
    const overdue = computeOrderOverdue({
      status: record.status,
      createdAt: record.createdAt,
      estimatedMinutes,
      delayMinutes,
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      tableId: record.tableId,
      status: record.status,
      kitchenStatus: (record.kitchenStatus as OrderStatus) || undefined,
      barStatus: (record.barStatus as OrderStatus) || undefined,
      destinationStatus: {
        ...(record.kitchenStatus ? { kitchen: record.kitchenStatus as OrderStatus } : {}),
        ...(record.barStatus ? { bar: record.barStatus as OrderStatus } : {}),
      },
      total: Number(record.total),
      items,
      notes,
      estimatedMinutes,
      delayMinutes,
      overdue,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      cancelledAt: record.cancelledAt
        ? record.cancelledAt instanceof Date
          ? record.cancelledAt.toISOString()
          : record.cancelledAt
        : undefined,
      cancelReason: record.cancelReason ?? undefined,
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
          kitchenStatus: (order.kitchenStatus as any) ?? (order.items.some((i) => (i.destination || 'kitchen') === 'kitchen') ? 'PLACED' : null),
          barStatus: (order.barStatus as any) ?? (order.items.some((i) => i.destination === 'bar') ? 'PLACED' : null),
          total: order.total,
          notes: order.notes ?? null,
          estimatedMinutes: order.estimatedMinutes ?? null,
          delayMinutes: order.delayMinutes ?? 0,
          items: {
            create: order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              notes: item.notes,
              destination: item.destination || 'kitchen',
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
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { tenantId, id },
      });
      if (!existing) {
        throw new Error(`Order ${id} not found`);
      }
      const fromStatus = existing.status;
      const updated = await tx.order.update({
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

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus,
          toStatus: 'CANCELLED',
          occurredAt: cancelledAt,
        },
      });

      return this.mapToDTO(updated);
    });
  }

  async cancelForCheckout(
    tenantId: string,
    orderIds: string[],
    at: Date
  ): Promise<OrderDTO[]> {
    if (orderIds.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx) => {
      const existingOrders = await tx.order.findMany({
        where: { tenantId, id: { in: orderIds } },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
        },
      });

      const updatedOrders: any[] = [];

      for (const order of existingOrders) {
        const fromStatus = order.status;
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            ...(order.kitchenStatus !== null ? { kitchenStatus: 'CANCELLED' } : {}),
            ...(order.barStatus !== null ? { barStatus: 'CANCELLED' } : {}),
            cancelReason: 'checkout',
            cancelledAt: at,
          },
          include: {
            items: {
              include: {
                modifiers: true,
              },
            },
          },
        });

        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            fromStatus,
            toStatus: 'CANCELLED',
            reason: 'checkout',
            occurredAt: at,
          },
        });

        updatedOrders.push(updated);
      }

      return updatedOrders.map((r) => this.mapToDTO(r));
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    updatedAt: Date,
    destMeta?: {
      kitchenStatus?: OrderStatus;
      barStatus?: OrderStatus;
    }
  ): Promise<OrderDTO> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { tenantId, id },
      });
      if (!existing) {
        throw new Error(`Order ${id} not found`);
      }
      const fromStatus = existing.status;
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: status as any,
          ...(destMeta?.kitchenStatus ? { kitchenStatus: destMeta.kitchenStatus as any } : {}),
          ...(destMeta?.barStatus ? { barStatus: destMeta.barStatus as any } : {}),
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

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus,
          toStatus: status,
          occurredAt: updatedAt,
        },
      });

      return this.mapToDTO(updated);
    });
  }

  async updateDelay(tenantId: string, id: string, delayMinutes: number): Promise<OrderDTO> {
    const existing = await this.prisma.order.findFirst({
      where: { tenantId, id },
    });
    if (!existing) {
      throw new Error(`Order ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        delayMinutes,
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

  async getOrderHistory(tenantId: string, orderId: string): Promise<OrderHistoryEventDTO[]> {
    const order = await this.prisma.order.findFirst({
      where: { tenantId, id: orderId },
    });
    if (!order) {
      return [];
    }

    const records = await this.prisma.orderStatusEvent.findMany({
      where: { orderId },
      orderBy: { occurredAt: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      occurredAt: r.occurredAt.toISOString(),
      reason: r.reason ?? undefined,
    }));
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
