import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';

export function requireStaffRole(allowedRoles: string[] = ['staff', 'manager', 'admin', 'waiter']) {
  return (req: Request, res: Response, next: NextFunction) => {
    let role = (req.headers['x-user-role'] as string || '').toLowerCase();

    if (!role && req.headers['authorization']?.startsWith('Bearer ')) {
      try {
        const token = req.headers['authorization'].substring(7);
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        if (decoded?.role) {
          role = String(decoded.role).toLowerCase();
        }
      } catch {
        // ignore
      }
    }

    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!role || !normalizedAllowed.includes(role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Se requiere rol de personal autorizado',
        },
      });
    }

    next();
  };
}

