import { PrismaClient } from '../../generated/client';
import { ProductRepository, ProductDTO } from '@packages/shared-types';

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(
    tenantId: string,
    filter?: { categoryId?: string; onlyAvailable?: boolean }
  ): Promise<ProductDTO[]> {
    const where: any = { tenantId };
    if (filter?.categoryId) where.categoryId = filter.categoryId;
    if (filter?.onlyAvailable) where.isAvailable = true;

    const list = await this.prisma.product.findMany({
      where,
      include: {
        modifierGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return list.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description || undefined,
      price: Number(p.price),
      imageUrl: p.imageUrl || undefined,
      isAvailable: p.isAvailable,
      sortOrder: p.sortOrder,
      prepTimeMinutes: p.prepTimeMinutes ?? undefined,
      modifierGroups: p.modifierGroups.map((pmg) => ({
        id: pmg.group.id,
        tenantId: pmg.group.tenantId,
        name: pmg.group.name,
        minSelections: pmg.group.minSelections,
        maxSelections: pmg.group.maxSelections,
        isRequired: pmg.group.isRequired,
        options: pmg.group.options.map((opt) => ({
          id: opt.id,
          groupId: opt.groupId,
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
          isDefault: opt.isDefault,
        })),
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async findById(tenantId: string, id: string): Promise<ProductDTO | null> {
    const p = await this.prisma.product.findFirst({
      where: { tenantId, id },
      include: {
        modifierGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      tenantId: p.tenantId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description || undefined,
      price: Number(p.price),
      imageUrl: p.imageUrl || undefined,
      isAvailable: p.isAvailable,
      sortOrder: p.sortOrder,
      prepTimeMinutes: p.prepTimeMinutes ?? undefined,
      modifierGroups: p.modifierGroups.map((pmg) => ({
        id: pmg.group.id,
        tenantId: pmg.group.tenantId,
        name: pmg.group.name,
        minSelections: pmg.group.minSelections,
        maxSelections: pmg.group.maxSelections,
        isRequired: pmg.group.isRequired,
        options: pmg.group.options.map((opt) => ({
          id: opt.id,
          groupId: opt.groupId,
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
          isDefault: opt.isDefault,
        })),
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async save(tenantId: string, product: ProductDTO): Promise<ProductDTO> {
    const saved = await this.prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        categoryId: product.categoryId,
        sortOrder: product.sortOrder,
        isAvailable: product.isAvailable,
        prepTimeMinutes: product.prepTimeMinutes,
      },
      create: {
        id: product.id,
        tenantId,
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        sortOrder: product.sortOrder,
        isAvailable: product.isAvailable,
        prepTimeMinutes: product.prepTimeMinutes,
      },
    });

    return {
      ...product,
      id: saved.id,
      tenantId: saved.tenantId,
      price: Number(saved.price),
      prepTimeMinutes: saved.prepTimeMinutes ?? undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.product.deleteMany({
      where: { tenantId, id },
    });
  }

  async setAvailability(tenantId: string, id: string, isAvailable: boolean): Promise<ProductDTO> {
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isAvailable },
    });
    return {
      id: updated.id,
      tenantId: updated.tenantId,
      categoryId: updated.categoryId,
      name: updated.name,
      description: updated.description || undefined,
      price: Number(updated.price),
      imageUrl: updated.imageUrl || undefined,
      isAvailable: updated.isAvailable,
      sortOrder: updated.sortOrder,
      prepTimeMinutes: updated.prepTimeMinutes ?? undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async attachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { tenantId, id: productId } });
    if (!product) return;
    await this.prisma.productModifierGroup.upsert({
      where: {
        productId_groupId: { productId, groupId },
      },
      update: {},
      create: { productId, groupId },
    });
  }

  async detachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { tenantId, id: productId } });
    if (!product) return;
    await this.prisma.productModifierGroup.deleteMany({
      where: { productId, groupId },
    });
  }
}
