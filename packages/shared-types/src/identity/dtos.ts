export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type UppercaseUserRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'CUSTOMER'
  | 'WAITER'
  | 'MONITOR'
  | 'CASHIER';

export type LowercaseUserRole =
  | 'admin'
  | 'manager'
  | 'customer'
  | 'waiter'
  | 'monitor'
  | 'cashier';

export type UserRole = UppercaseUserRole | LowercaseUserRole;

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';

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
  avatarUrl?: string | null;
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
  adminDisplayName?: string;
}

export interface RegisterTenantResult {
  tenant: TenantDTO;
  user: UserDTO;
  tokens: AuthTokens;
}

export interface CreateTeamMemberRequest {
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
  monitorKind?: MonitorKind | string | null;
  avatarUrl?: string | null;
}

export interface UpdateTeamMemberRequest {
  displayName?: string;
  role?: UserRole;
  avatarUrl?: string | null;
}

export interface SetTeamMemberStatusRequest {
  status: 'ACTIVE' | 'DISABLED';
}

export interface ResetTeamMemberPasswordRequest {
  password?: string;
}

export interface ResetTeamMemberPasswordResult {
  message: string;
  password?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
