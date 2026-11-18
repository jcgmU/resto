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
      operatingMode: (t.operatingMode as any) || 'hybrid',
      estimatedPrepMinutes: t.estimatedPrepMinutes ?? 18,
      invoiceMode: (t.invoiceMode as any) || 'simple',
      currency: t.currency || 'COP',
      locale: t.locale || 'es-CO',
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
      operatingMode: (t.operatingMode as any) || 'hybrid',
      estimatedPrepMinutes: t.estimatedPrepMinutes ?? 18,
      invoiceMode: (t.invoiceMode as any) || 'simple',
      currency: t.currency || 'COP',
      locale: t.locale || 'es-CO',
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
        operatingMode: tenant.operatingMode ?? 'hybrid',
        estimatedPrepMinutes: tenant.estimatedPrepMinutes ?? 18,
        invoiceMode: tenant.invoiceMode ?? 'simple',
        currency: tenant.currency ?? 'COP',
        locale: tenant.locale ?? 'es-CO',
      },
      create: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status as any,
        operatingMode: tenant.operatingMode ?? 'hybrid',
        estimatedPrepMinutes: tenant.estimatedPrepMinutes ?? 18,
        invoiceMode: tenant.invoiceMode ?? 'simple',
        currency: tenant.currency ?? 'COP',
        locale: tenant.locale ?? 'es-CO',
      },
    });
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      operatingMode: t.operatingMode as any,
      estimatedPrepMinutes: t.estimatedPrepMinutes,
      invoiceMode: (t.invoiceMode as any) || 'simple',
      currency: t.currency || 'COP',
      locale: t.locale || 'es-CO',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async updateSettings(
    id: string,
    settings: { operatingMode?: string; estimatedPrepMinutes?: number; invoiceMode?: string; currency?: string; locale?: string }
  ): Promise<TenantDTO> {
    const data: any = {};
    if (settings.operatingMode !== undefined) {
      data.operatingMode = settings.operatingMode;
    }
    if (settings.estimatedPrepMinutes !== undefined) {
      data.estimatedPrepMinutes = settings.estimatedPrepMinutes;
    }
    if (settings.invoiceMode !== undefined) {
      data.invoiceMode = settings.invoiceMode;
    }
    if (settings.currency !== undefined) {
      data.currency = settings.currency;
    }
    if (settings.locale !== undefined) {
      data.locale = settings.locale;
    }

    const t = await this.prisma.tenant.update({
      where: { id },
      data,
    });

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      operatingMode: t.operatingMode as any,
      estimatedPrepMinutes: t.estimatedPrepMinutes,
      invoiceMode: (t.invoiceMode as any) || 'simple',
      currency: t.currency || 'COP',
      locale: t.locale || 'es-CO',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } }).catch(() => {});
  }
}
