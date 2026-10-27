import { TenantRepository, TenantDTO } from '@packages/shared-types';
import { PrismaClient } from '../../generated/client';

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TenantDTO | null> {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async findBySlug(slug: string): Promise<TenantDTO | null> {
    const t = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async save(tenant: TenantDTO): Promise<TenantDTO> {
    const t = await this.prisma.tenant.upsert({
      where: { id: tenant.id },
      update: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status as any,
      },
      create: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status as any,
      },
    });
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } }).catch(() => {});
  }
}
