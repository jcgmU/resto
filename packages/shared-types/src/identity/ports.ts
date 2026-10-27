import { UseCase } from '../common/UseCase';
import {
  TenantDTO,
  UserDTO,
  AuthTokens,
  AccessTokenClaims,
  RegisterTenantRequest,
  RegisterTenantResult,
} from './dtos';

export interface TenantRepository {
  findById(id: string): Promise<TenantDTO | null>;
  findBySlug(slug: string): Promise<TenantDTO | null>;
  save(tenant: TenantDTO): Promise<TenantDTO>;
  delete?(id: string): Promise<void>;
}

export interface UserRepository {
  findById(id: string): Promise<UserDTO | null>;
  findByEmail(tenantId: string, email: string): Promise<UserDTO | null>;
  findWithPasswordByEmail(tenantId: string, email: string): Promise<(UserDTO & { passwordHash: string }) | null>;
  findWithPasswordById?(id: string): Promise<(UserDTO & { passwordHash: string }) | null>;
  listByTenant(tenantId: string): Promise<UserDTO[]>;
  save(user: UserDTO & { passwordHash: string }): Promise<UserDTO>;
}

export interface RefreshTokenRepository {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser?(userId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface TokenIssuer {
  issueAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>): string;
  generateRefreshToken(): { raw: string; hash: string };
}

// Casos de uso (firmas)
export type RegisterTenantUseCase = UseCase<RegisterTenantRequest, RegisterTenantResult>;
export type LoginUseCase = UseCase<{ email: string; password: string; tenantSlug?: string }, { user: UserDTO; tokens: AuthTokens }>;
export type RefreshSessionUseCase = UseCase<{ refreshToken: string }, AuthTokens>;
export type InviteUserUseCase = UseCase<{ tenantId: string; email: string; displayName: string; role: 'MANAGER' | 'STAFF'; password?: string }, UserDTO>;
export type CreateTeamMemberUseCase = UseCase<{ tenantId: string; email: string; displayName: string; role: 'MANAGER' | 'STAFF'; password: string }, UserDTO>;
export type ChangePasswordUseCase = UseCase<{ userId: string; currentPassword: string; newPassword: string }, void>;
