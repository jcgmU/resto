import { RefreshTokenRepository, DomainError } from '@packages/shared-types';
import { PrismaClient } from '../../generated/client';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    const rt = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userId: true,
      },
    });
    return rt;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(
    oldTokenHash: string,
    newToken: { tokenHash: string; expiresAt: Date }
  ): Promise<{ userId: string }> {
    const now = new Date();

    const updateResult = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: oldTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco inválido o expirado');
    }

    const oldToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: oldTokenHash },
      select: { userId: true },
    });

    if (!oldToken) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco inválido o expirado');
    }

    await this.prisma.refreshToken.create({
      data: {
        userId: oldToken.userId,
        tokenHash: newToken.tokenHash,
        expiresAt: newToken.expiresAt,
      },
    });

    return { userId: oldToken.userId };
  }
}
