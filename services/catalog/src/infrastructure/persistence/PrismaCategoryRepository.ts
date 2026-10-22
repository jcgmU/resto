import { PrismaClient } from '../../generated/client';
import { CategoryRepository, CategoryDTO } from '@packages/shared-types';

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTenant(tenantId: string): Promise<CategoryDTO[]> {
    const list = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return list.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      destination: (c.destination as any) || 'kitchen',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async findById(tenantId: string, id: string): Promise<CategoryDTO | null> {
    const c = await this.prisma.category.findFirst({
      where: { tenantId, id },
    });
    if (!c) return null;
    return {
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      destination: (c.destination as any) || 'kitchen',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  async save(tenantId: string, category: CategoryDTO): Promise<CategoryDTO> {
    if (category.id) {
      const existing = await this.prisma.category.findFirst({
        where: { tenantId, id: category.id },
      });
      if (existing) {
        const updated = await this.prisma.category.update({
          where: { id: category.id },
          data: {
            name: category.name,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            destination: category.destination || 'kitchen',
          },
        });
        return {
          id: updated.id,
          tenantId: updated.tenantId,
          name: updated.name,
          sortOrder: updated.sortOrder,
          isActive: updated.isActive,
          destination: (updated.destination as any) || 'kitchen',
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      }
    }

    const saved = await this.prisma.category.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: category.name,
        },
      },
      update: {
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        destination: category.destination || 'kitchen',
      },
      create: {
        id: category.id,
        tenantId,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        destination: category.destination || 'kitchen',
      },
    });
    return {
      id: saved.id,
      tenantId: saved.tenantId,
      name: saved.name,
      sortOrder: saved.sortOrder,
      isActive: saved.isActive,
      destination: (saved.destination as any) || 'kitchen',
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.category.deleteMany({
      where: { tenantId, id },
    });
  }

  async hasProducts(tenantId: string, id: string): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: { tenantId, categoryId: id },
    });
    return count > 0;
  }
}
