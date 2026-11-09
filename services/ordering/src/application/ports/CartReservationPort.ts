import { CartDTO, CartItemDTO } from '@packages/shared-types';

export interface CartReservation {
  operationId: string;
  orderId: string;
  tenantId: string;
  sessionId: string;
  items: CartItemDTO[];
  createdAt: string;
}

export interface CartReservationPort {
  addItemAtomic(
    tenantId: string,
    sessionId: string,
    canonicalKey: string,
    item: CartItemDTO,
    inputQuantity: number,
    maxQuantity: number,
    ttlSeconds: number
  ): Promise<{ cart: CartDTO; mergedQuantity: number }>;

  reserveCart(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    ttlSeconds: number
  ): Promise<{
    status: 'RESERVED' | 'EXISTING_RESERVATION' | 'EMPTY';
    reservation?: CartReservation;
  }>;

  findReservation(tenantId: string, sessionId: string): Promise<CartReservation | null>;

  ackReservation(tenantId: string, sessionId: string, operationId?: string): Promise<void>;

  restoreReservation(
    tenantId: string,
    sessionId: string,
    operationId: string,
    ttlSeconds: number,
    options?: { requireExpiredLease?: boolean }
  ): Promise<{
    status: 'RESTORED' | 'NOT_FOUND' | 'CONFLICT' | 'ACTIVE';
    maxExceededQty?: number;
  }>;

  isReservationLeaseActive(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean>;

  refreshReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean>;

  releaseReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<void>;

  clearAll?(tenantId: string, sessionId: string): Promise<void>;
}

const inFlightOperations = new Set<string>();

export function markOperationInFlight(operationId: string): void {
  inFlightOperations.add(operationId);
}

export function markOperationFinished(operationId: string): void {
  inFlightOperations.delete(operationId);
}

export function isOperationInFlight(operationId: string): boolean {
  return inFlightOperations.has(operationId);
}

export function clearInFlightOperations(): void {
  inFlightOperations.clear();
}

export type ReservationFenceStatus = 'COMMITTED' | 'ABORTED';

export interface OrderReservationFencePort {
  claimReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    tx?: unknown
  ): Promise<ReservationFenceStatus>;

  abortReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    tx?: unknown
  ): Promise<ReservationFenceStatus>;
}

