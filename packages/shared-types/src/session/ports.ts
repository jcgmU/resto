import { UseCase } from '../common/UseCase';
import {
  TableDTO,
  TableSessionDTO,
  GuestTokenClaims,
  OpenSessionRequest,
  OpenSessionResult,
  QrCodeResult,
} from './dtos';

export interface TableRepository {
  save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO>;
  findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null>;
  listByTenant(tenantId: string): Promise<TableDTO[]>;
  delete(tenantId: string, tableId: string): Promise<void>;
}

export interface ZoneRepository {
  save(tenantId: string, zone: import('./dtos').ZoneDTO): Promise<import('./dtos').ZoneDTO>;
  findById(tenantId: string, zoneId: string): Promise<import('./dtos').ZoneDTO | null>;
  listByTenant(tenantId: string): Promise<import('./dtos').ZoneDTO[]>;
  delete(tenantId: string, zoneId: string): Promise<void>;
}

export interface ReservationRepository {
  save(tenantId: string, reservation: import('./dtos').ReservationDTO): Promise<import('./dtos').ReservationDTO>;
  findById(tenantId: string, reservationId: string): Promise<import('./dtos').ReservationDTO | null>;
  listByTenant(
    tenantId: string,
    filter?: { tableId?: string; date?: string; status?: import('./dtos').ReservationStatus }
  ): Promise<import('./dtos').ReservationDTO[]>;
  listByTable(tenantId: string, tableId: string): Promise<import('./dtos').ReservationDTO[]>;
  delete(tenantId: string, reservationId: string): Promise<void>;
}

export interface TableSessionRepository {
  findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null>;
  findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null>;
  save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO>;
  close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO>;
  requestBill(tenantId: string, sessionId: string): Promise<TableSessionDTO>;
  reopenBill(tenantId: string, sessionId: string): Promise<TableSessionDTO>;
  listByTenant(tenantId: string, filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string }): Promise<TableSessionDTO[]>;
  touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void>;
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
  { tenantId: string; label: string; zoneId?: string; capacity?: number; status?: import('./dtos').TableStatus },
  TableDTO
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

