export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type OperatingMode = 'hybrid' | 'waiter_only';

export interface PublicTenantSettingsDTO {
  operatingMode: OperatingMode;
}

export interface TenantSettingsDTO extends PublicTenantSettingsDTO {
  estimatedPrepMinutes: number;
}

export interface UpdateTenantSettingsRequest {
  operatingMode?: OperatingMode;
  estimatedPrepMinutes?: number;
}

export interface TenantDTO {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  operatingMode?: OperatingMode;
  estimatedPrepMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDTO {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  role: UserRole | string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RegisterTenantRequest {
  restaurantName: string;
  slug?: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
}

export interface RegisterTenantResult {
  tenant: TenantDTO;
  user: UserDTO;
  tokens: AuthTokens;
}
