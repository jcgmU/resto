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

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

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
    };
  }

  async save(tenantId: string, order: OrderDTO): Promise<OrderDTO> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          id: order.id,
          tenantId,
          sessionId: order.sessionId,
          tableId: order.tableId,
          status: order.status as any,
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
    });
  }

  async findById(tenantId: string, id: string): Promise<OrderDTO | null> {
    const record = await this.prisma.order.findFirst({
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

  async listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]> {
    const records = await this.prisma.order.findMany({
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

    return records.map((r) => this.mapToDTO(r));
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

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    updatedAt: Date
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
    }));
  }
}
