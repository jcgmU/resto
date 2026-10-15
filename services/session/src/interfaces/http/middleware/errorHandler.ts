import { Request, Response, NextFunction } from 'express';
import { DomainError } from '@packages/shared-types';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = err.message || 'Error interno del servidor';

  if (err instanceof DomainError) {
    code = err.code;
    switch (err.code) {
      case 'VALIDATION_ERROR':
      case 'BAD_USER_INPUT':
      case 'QR_KEY_INVALID':
      case 'TABLE_INACTIVE':
      case 'INVALID_SESSION_STATE':
        status = 400;
        break;
      case 'UNAUTHENTICATED':
        status = 401;
        break;
      case 'FORBIDDEN':
      case 'QR_DISABLED':
        status = 403;
        break;
      case 'TABLE_NOT_FOUND':
      case 'SESSION_NOT_FOUND':
      case 'SESSION_EXPIRED':
      case 'ZONE_NOT_FOUND':
      case 'RESERVATION_NOT_FOUND':
      case 'NOT_FOUND':
        status = 404;
        break;
      case 'TABLE_RESERVED':
      case 'ZONE_HAS_TABLES':
      case 'TABLE_HAS_ACTIVE_SESSION':
      case 'TABLE_HAS_ACTIVE_RESERVATION':
      case 'CONFLICT':
        status = 409;
        break;
      default:
        status = 400;
        break;
    }
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
