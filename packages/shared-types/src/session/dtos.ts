export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DISABLED' | 'active' | 'inactive';

export interface TableDTO {
  tableId: string;
  tenantId: string;
  label: string;
  status: TableStatus;
  zoneId?: string;
  capacity?: number;
  createdAt: string;
}

export interface ZoneDTO {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
}

export interface CreateZoneRequest {
  name: string;
  sortOrder?: number;
  id?: string;
}

export interface UpdateZoneRequest {
  name?: string;
  sortOrder?: number;
}

export type ReservationStatus = 'active' | 'seated' | 'cancelled';

export interface ReservationDTO {
  id: string;
  tenantId: string;
  tableId: string;
  customerName: string;
  phone: string;
  partySize: number;
  reservedFor: string;
  status: ReservationStatus;
  notes?: string;
  createdAt: string;
}

export interface CreateReservationRequest {
  tableId: string;
  customerName: string;
  phone: string;
  partySize: number;
  reservedFor: string;
  notes?: string;
}

export interface UpdateReservationRequest {
  customerName?: string;
  phone?: string;
  partySize?: number;
  reservedFor?: string;
  notes?: string;
}

export interface TableSessionDTO {
  sessionId: string;
  tenantId: string;
  tableId: string;
  status: 'active' | 'billRequested' | 'closed';
  createdAt: string;
  expiresAt: string;
  closedAt?: string;
  billRequestedAt?: string;
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
