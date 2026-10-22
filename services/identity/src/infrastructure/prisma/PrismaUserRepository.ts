import { UserRepository, UserDTO } from '@packages/shared-types';
import { PrismaClient } from '../../generated/client';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserDTO | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return this.mapToDto(u);
  }

  async findByEmail(tenantId: string, email: string): Promise<UserDTO | null> {
    const u = await this.findWithPasswordByEmail(tenantId, email);
    if (!u) return null;
    return this.mapToDto(u);
  }

  async findWithPasswordByEmail(tenantId: string, email: string): Promise<(UserDTO & { passwordHash: string }) | null> {
    const whereClause: any = { email: { equals: email, mode: 'insensitive' } };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    const u = await this.prisma.user.findFirst({
      where: whereClause,
    });
    if (!u) return null;
    return { ...this.mapToDto(u), passwordHash: u.passwordHash };
  }

  async listByTenant(tenantId: string): Promise<UserDTO[]> {
    const users = await this.prisma.user.findMany({ where: { tenantId } });
    return users.map((u) => this.mapToDto(u));
  }

  async save(user: UserDTO & { passwordHash: string }): Promise<UserDTO> {
    const u = await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        role: user.role as any,
        status: user.status as any,
        monitorKind: (user.monitorKind as any) ?? null,
      },
      create: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        role: user.role as any,
        status: user.status as any,
        monitorKind: (user.monitorKind as any) ?? null,
      },
    });
    return this.mapToDto(u);
  }

  private mapToDto(u: any): UserDTO {
    return {
      id: u.id,
      tenantId: u.tenantId,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      monitorKind: u.monitorKind,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}
