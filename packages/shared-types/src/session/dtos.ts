export interface TableDTO {
  tableId: string;
  tenantId: string;
  label: string;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: string;
  deletedAt?: string;
}

export interface TableSessionDTO {
  sessionId: string;
  tenantId: string;
  tableId: string;
  status: 'active' | 'closed';
  createdAt: string;
  expiresAt: string;
  closedAt?: string;
}

export interface GuestTokenClaims {
  tenantId: string;
  sessionId: string;
  role: 'guest';
}

export interface OpenSessionRequest {
  tenantId: string;
  tableId: string;
  qrKey: string;
}

export interface OpenSessionResult {
  session: TableSessionDTO;
  guestToken: string;
}

export interface QrCodeResult {
  url: string;
  pngDataUrl: string; // data:image/png;base64,...
}
