import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../../domain/errors';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof DomainError || err.code) {
    const code = err.code;
    let statusCode = 400;

    if (code === 'SESSION_REQUIRED') statusCode = 401;
    else if (code === 'FORBIDDEN') statusCode = 403;
    else if (
      code === 'PRODUCT_NOT_FOUND' ||
      code === 'ORDER_NOT_FOUND' ||
      code === 'SERVICE_CALL_NOT_FOUND' ||
      code === 'BILL_NOT_FOUND'
    )
      statusCode = 404;
    else if (
      code === 'INVALID_STATUS_TRANSITION' ||
      code === 'SESSION_NOT_ORDERABLE' ||
      code === 'TABLE_MISMATCH' ||
      code === 'PRODUCT_UNAVAILABLE'
    )
      statusCode = 409;
    else if (code === 'CATALOG_UNREACHABLE' || code === 'SESSION_CLOSE_FAILED') statusCode = 502;
    else if (
      code === 'CART_EMPTY' ||
      code === 'BILL_EMPTY' ||
      code === 'MODIFIER_REQUIRED' ||
      code === 'MODIFIER_INVALID' ||
      code === 'VALIDATION_ERROR'
    ) {
      statusCode = 400;
    }

    return res.status(statusCode).json({
      error: {
        code,
        message: err.message ? err.message.replace(/^[^:]+:\s*/, '') : err.message,
      },
    });
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Error interno del servidor',
    },
  });
}
