import {
  TenantRepository,
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  TokenIssuer,
  TenantDTO,
  UserDTO,
  AccessTokenClaims,
  DomainError,
} from '@packages/shared-types';
import { hashRefreshToken } from '../security/tokenHash';

export class InMemoryTenantRepository implements TenantRepository {
  public tenants: TenantDTO[] = [
    {
      id: 'tenant-pergola-dup',
      name: 'Pergola Existente',
      slug: 'pergola-duplicada',
      status: 'ACTIVE',
      operatingMode: 'hybrid',
      estimatedPrepMinutes: 18,
      invoiceMode: 'simple',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tenant-default',
      name: 'Default Tenant',
      slug: 'default-tenant',
      status: 'ACTIVE',
      operatingMode: 'hybrid',
      estimatedPrepMinutes: 18,
      invoiceMode: 'simple',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  async findById(id: string): Promise<TenantDTO | null> {
    return this.tenants.find((t) => t.id === id) || null;
  }

  async findBySlug(slug: string): Promise<TenantDTO | null> {
    return this.tenants.find((t) => t.slug === slug) || null;
  }

  async save(tenant: TenantDTO): Promise<TenantDTO> {
    const existingIndex = this.tenants.findIndex((t) => t.id === tenant.id);
    if (existingIndex >= 0) {
      this.tenants[existingIndex] = tenant;
    } else {
      this.tenants.push(tenant);
    }
    return tenant;
  }

  async updateSettings(
    id: string,
    settings: { operatingMode?: string; estimatedPrepMinutes?: number; invoiceMode?: string }
  ): Promise<TenantDTO> {
    const tenant = this.tenants.find((t) => t.id === id);
    if (!tenant) {
      throw new DomainError('NOT_FOUND', 'Tenant no encontrado');
    }
    if (settings.operatingMode !== undefined) {
      tenant.operatingMode = settings.operatingMode as any;
    }
    if (settings.estimatedPrepMinutes !== undefined) {
      tenant.estimatedPrepMinutes = settings.estimatedPrepMinutes;
    }
    if (settings.invoiceMode !== undefined) {
      tenant.invoiceMode = settings.invoiceMode as any;
    }
    tenant.updatedAt = new Date();
    return tenant;
  }
}

export class InMemoryUserRepository implements UserRepository {
  public users: (UserDTO & { passwordHash: string })[] = [
    {
      id: 'u-valid',
      tenantId: 'tenant-default',
      email: 'user@resto.com',
      displayName: 'User Valid',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: 'hashed_validpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'u-taken',
      tenantId: 'tenant-default',
      email: 'taken@pergola.com',
      displayName: 'User Taken',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: 'hashed_password123',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  async findById(id: string): Promise<UserDTO | null> {
    const u = this.users.find((user) => user.id === id);
    if (!u) return null;
    const { passwordHash, ...userDto } = u;
    return userDto;
  }

  async findByEmail(tenantId: string, email: string): Promise<UserDTO | null> {
    const u = await this.findWithPasswordByEmail(tenantId, email);
    if (!u) return null;
    const { passwordHash, ...userDto } = u;
    return userDto as UserDTO;
  }

  async findWithPasswordByEmail(tenantId: string, email: string): Promise<(UserDTO & { passwordHash: string }) | null> {
    const u = this.users.find((user) => {
      const matchEmail = user.email.toLowerCase() === email.toLowerCase();
      return tenantId ? user.tenantId === tenantId && matchEmail : matchEmail;
    });
    if (!u) return null;
    return u;
  }

  async listByTenant(tenantId: string): Promise<UserDTO[]> {
    return this.users
      .filter((u) => u.tenantId === tenantId)
      .map(({ passwordHash, ...userDto }) => userDto);
  }

  async save(user: UserDTO & { passwordHash: string }): Promise<UserDTO> {
    const existingIndex = this.users.findIndex((u) => u.id === user.id);
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
    const { passwordHash, ...userDto } = user;
    return userDto;
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  public tokens: { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }[] = [
    {
      id: 'rt-valid',
      userId: 'u-valid',
      tokenHash: hashRefreshToken('valid-refresh-token'),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    },
    {
      id: 'rt-expired',
      userId: 'u-valid',
      tokenHash: hashRefreshToken('expired-or-revoked-token'),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: new Date(),
    },
  ];

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.tokens.push({
      id: `rt-${this.tokens.length + 1}`,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
  }

  async findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash && !t.revokedAt && t.expiresAt > new Date());
    if (!token) return null;
    return { id: token.id, userId: token.userId };
  }

  async revoke(id: string): Promise<void> {
    const token = this.tokens.find((t) => t.id === id);
    if (token) {
      token.revokedAt = new Date();
    }
  }

  async rotate(
    oldTokenHash: string,
    newToken: { tokenHash: string; expiresAt: Date }
  ): Promise<{ userId: string }> {
    const now = new Date();
    const token = this.tokens.find(
      (t) => t.tokenHash === oldTokenHash && !t.revokedAt && t.expiresAt > now
    );

    if (!token) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco inválido o expirado');
    }

    token.revokedAt = now;

    this.tokens.push({
      id: `rt-${this.tokens.length + 1}`,
      userId: token.userId,
      tokenHash: newToken.tokenHash,
      expiresAt: newToken.expiresAt,
      revokedAt: null,
    });

    return { userId: token.userId };
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed_${plain}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed_${plain}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  issueAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>): string {
    return `jwt_${claims.sub}_${claims.tenantId}_${claims.role}`;
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = `raw_token_${Math.random()}`;
    return {
      raw,
      hash: hashRefreshToken(raw),
    };
  }
}
