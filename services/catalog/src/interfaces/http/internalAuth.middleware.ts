import { Request, Response, NextFunction } from 'express';

export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || (req.method === 'GET' && req.path.startsWith('/uploads'))) {
    return next();
  }

  const expectedSecret = process.env.INTERNAL_SHARED_SECRET;
  if (expectedSecret) {
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

  return next();
}
