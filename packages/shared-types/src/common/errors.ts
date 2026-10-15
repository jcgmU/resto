export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_TAKEN'
  | 'SLUG_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'BAD_USER_INPUT'
  | 'CONFLICT'
  | 'CATEGORY_NOT_EMPTY'
  | 'QR_KEY_INVALID'
  | 'TABLE_NOT_FOUND'
  | 'TABLE_INACTIVE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'INVALID_SESSION_STATE'
  | 'TABLE_RESERVED'
  | 'ZONE_NOT_FOUND'
  | 'ZONE_HAS_TABLES'
  | 'TABLE_HAS_ACTIVE_SESSION'
  | 'TABLE_HAS_ACTIVE_RESERVATION'
  | 'RESERVATION_NOT_FOUND'
  | 'QR_DISABLED';

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
