import { UseCase } from '../common/UseCase';
import {
  TableDTO,
  TableStatus,
  TableSessionDTO,
  GuestTokenClaims,
  OpenSessionRequest,
  OpenSessionResult,
  QrCodeResult,
  ZoneDTO,
  ReservationDTO,
  ReservationStatus,
  DeleteTablesBatchResult,
} from './dtos';

export interface TableRepository {
  save(tenantId: string, table: TableDTO & { qrKey: string; labelKey?: string }): Promise<TableDTO>;
  findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string; labelKey?: string }) | null>;
  listByTenant(tenantId: string): Promise<TableDTO[]>;
  createMany(
    tenantId: string,
    tables: Array<TableDTO & { qrKey: string; labelKey?: string }>
  ): Promise<TableDTO[]>;
  updateMany(
    tenantId: string,
    updates: Array<{
      tableId: string;
      label?: string;
      labelKey?: string;
      status?: TableStatus;
      zoneId?: string;
      capacity?: number;
    }>
  ): Promise<TableDTO[]>;
  softDeleteMany(
    tenantId: string,
    items: Array<{ tableId: string; deletedAt: string; newQrKey: string }>
  ): Promise<{
    deleted: string[];
    failed: Array<{
      tableId: string;
      code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' | 'TABLE_HAS_RESERVATIONS';
    }>;
  }>;
  delete?(tenantId: string, tableId: string): Promise<void>;
  findByLabelKey?(tenantId: string, labelKey: string): Promise<(TableDTO & { qrKey: string }) | null>;
  rotateQrAtomic?(
    tenantId: string,
    tableId: string,
    newQrKey: string
  ): Promise<(TableDTO & { qrKey: string }) | null>;
}

export interface ZoneRepository {
  save(tenantId: string, zone: ZoneDTO): Promise<ZoneDTO>;
  findById(tenantId: string, zoneId: string): Promise<ZoneDTO | null>;
  listByTenant(tenantId: string): Promise<ZoneDTO[]>;
  delete(tenantId: string, zoneId: string): Promise<void>;
}

export interface ReservationRepository {
  save(tenantId: string, reservation: ReservationDTO): Promise<ReservationDTO>;
  findById(tenantId: string, reservationId: string): Promise<ReservationDTO | null>;
  listByTenant(
    tenantId: string,
    filter?: { tableId?: string; date?: string; status?: ReservationStatus }
  ): Promise<ReservationDTO[]>;
  listByTable(tenantId: string, tableId: string): Promise<ReservationDTO[]>;
  delete(tenantId: string, reservationId: string): Promise<void>;
}

export interface TableSessionRepository {
  findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null>;
  findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null>;
  save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO>;
  close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO>;
  requestBill(tenantId: string, sessionId: string): Promise<TableSessionDTO>;
  reopenBill(tenantId: string, sessionId: string): Promise<TableSessionDTO>;
  listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string }
  ): Promise<TableSessionDTO[]>;
  touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void>;
  moveToTable?(tenantId: string, sessionId: string, targetTableId: string): Promise<TableSessionDTO>;
  getOrCreateActive?(
    tenantId: string,
    tableId: string,
    candidateOrTtl: TableSessionDTO | number,
    maybeTtl?: number
  ): Promise<TableSessionDTO>;
}

export interface QrCodeGenerator {
  generate(payloadUrl: string): Promise<QrCodeResult>;
}

export interface GuestTokenIssuer {
  issue(claims: GuestTokenClaims, ttlSeconds: number): string;
}

export type CreateTableUseCase = UseCase<
  { tenantId: string; label: string; zoneId?: string; capacity?: number; status?: TableStatus },
  TableDTO
>;
export type CreateTablesBatchUseCase = UseCase<
  { tenantId: string; body: unknown },
  { tables: TableDTO[] }
>;
export type UpdateTablesBatchUseCase = UseCase<
  { tenantId: string; body: unknown },
  { tables: TableDTO[] }
>;
export type UpdateSingleTableUseCase = UseCase<
  { tenantId: string; tableId: string; body: unknown },
  TableDTO
>;
export type DeleteTablesBatchUseCase = UseCase<
  { tenantId: string; body: unknown },
  DeleteTablesBatchResult
>;
export type GenerateTableQrUseCase = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type RotateTableQrKeyUseCase = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type OpenTableSessionUseCase = UseCase<OpenSessionRequest, OpenSessionResult>;
export type GetTableSessionUseCase = UseCase<
  { tenantId: string; sessionId: string; requester: { role: string; sessionId?: string } },
  TableSessionDTO
>;
export type CloseTableSessionUseCase = UseCase<{ tenantId: string; sessionId: string }, TableSessionDTO>;
export type RequestBillSessionUseCase = UseCase<{ tenantId: string; sessionId: string }, TableSessionDTO>;
export type ReopenBillSessionUseCase = UseCase<{ tenantId: string; sessionId: string }, TableSessionDTO>;
export type ListTableSessionsUseCase = UseCase<
  { tenantId: string; filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string } },
  TableSessionDTO[]
>;
export type StaffOpenSessionUseCase = UseCase<{ tenantId: string; tableId: string }, { session: TableSessionDTO }>;
export type UpdateReservationUseCase = UseCase<
  {
    tenantId: string;
    reservationId: string;
    customerName?: string;
    phone?: string;
    partySize?: number;
    reservedFor?: string;
    notes?: string;
  },
  ReservationDTO
>;
