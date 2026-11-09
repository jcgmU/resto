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
  | 'TABLE_LABEL_TAKEN'
  | 'TABLE_LIMIT_EXCEEDED'
  | 'TABLES_NOT_DELETABLE'
  | 'TABLE_HAS_ACTIVE_SESSION'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
