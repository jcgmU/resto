import type { Polygon } from '../floorplan/geometry';

export type TableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'DISABLED'
  | 'active'
  | 'inactive'
  | 'deleted';

export interface TableDTO {
  tableId: string;
  id?: string;
  tenantId: string;
  label: string;
  labelKey?: string;
  status: TableStatus;
  zoneId?: string;
  capacity?: number;
  activeSessionId?: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export type CreateTablesBatchInput =
  | {
      prefix: string;
      count: number;
      start?: number;
      zoneId: string;
      capacity?: number;
    }
  | {
      labels: string[];
      zoneId: string;
      capacity?: number;
    };

export interface TableUpdatePatch {
  tableId: string;
  label?: string;
  labelKey?: string;
  status?: TableStatus;
  zoneId?: string;
  capacity?: number;
}

export interface UpdateTablesBatchInput {
  updates: TableUpdatePatch[];
}

export interface DeleteTablesBatchInput {
  tableIds: string[];
}

export interface DeleteBatchFailedItem {
  tableId: string;
  code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' | 'TABLE_HAS_RESERVATIONS';
}

export interface DeleteTablesBatchResult {
  deleted: string[];
  failed: DeleteBatchFailedItem[];
}

export interface TableBatchItemInput {
  tableId?: string;
  label?: string;
  labelKey?: string;
  status?: TableStatus;
  zoneId?: string;
  capacity?: number;
}

export interface ZoneDTO {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  staffIds?: string[];
  polygon?: Polygon;
}

export interface CreateZoneRequest {
  name: string;
  sortOrder?: number;
  id?: string;
  staffIds?: string[];
  polygon?: Polygon | null;
}

export interface UpdateZoneRequest {
  name?: string;
  sortOrder?: number;
  staffIds?: string[];
  polygon?: Polygon | null;
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
