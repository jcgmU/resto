export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER' | 'WAITER' | 'MONITOR' | 'CASHIER';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export type OperatingMode = 'hybrid' | 'waiter_only';
export type InvoiceMode = 'simple' | 'dian';
export type MonitorKind = 'kitchen' | 'bar';

export interface PublicTenantSettingsDTO {
  operatingMode: OperatingMode;
}

export interface TenantSettingsDTO extends PublicTenantSettingsDTO {
  estimatedPrepMinutes: number;
  invoiceMode?: InvoiceMode;
}

export interface UpdateTenantSettingsRequest {
  operatingMode?: OperatingMode;
  estimatedPrepMinutes?: number;
  invoiceMode?: InvoiceMode;
}

export interface TenantDTO {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  operatingMode?: OperatingMode;
  estimatedPrepMinutes?: number;
  invoiceMode?: InvoiceMode;
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
  monitorKind?: MonitorKind | string | null;
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
  displayName?: string;
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
