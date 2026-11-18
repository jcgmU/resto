import { Request, Response, NextFunction } from 'express';

export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') {
    return next();
  }

  const expectedSecret = process.env.INTERNAL_SHARED_SECRET;
  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_INTERNAL_AUTH === 'true') {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_AUTH_MISCONFIGURED',
          message: 'INTERNAL_SHARED_SECRET no está configurado en el entorno',
        },
      });
    }
    console.warn('[SECURITY WARN] INTERNAL_SHARED_SECRET no está configurado. Permitiendo acceso en modo dev/test (escape dev).');
    return next();
  }

  const token = req.headers['x-internal-token'];
  if (!token || token !== expectedSecret) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token interno requerido o inválido',
      },
    });
  }

  return next();
}
