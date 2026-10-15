import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';

export interface GatewayAuth {
  tenantId: string;
  role?: string;
  userId?: string;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: GatewayAuth;
    }
  }
}

export function requireGatewayIdentity(req: Request, res: Response, next: NextFunction) {
  let tenantId = req.headers['x-tenant-id'] as string;
  let role = req.headers['x-user-role'] as string;
  let userId = req.headers['x-user-id'] as string;
  let sessionId = req.headers['x-session-id'] as string;

  // Inspect Authorization header or x-guest-token if present
  const authHeader = (req.headers['authorization'] as string) || (req.headers['x-guest-token'] as string);
  let tokenClaims: any = null;
  if (authHeader) {
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    try {
      tokenClaims = jwt.verify(rawToken, config.jwtSecret) as any;
    } catch {
      // Si el token es inválido pero hay headers gateway, continuamos; de lo contrario se manejará
    }
  }

  if (tokenClaims) {
    tenantId = tenantId || tokenClaims.tenantId;
    role = role || tokenClaims.role;
    userId = userId || tokenClaims.userId || tokenClaims.sub;

    const tokenRole = (tokenClaims.role || role || '').toUpperCase();
    const isStaff = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER'].includes(tokenRole);

    if (!isStaff) {
      // Prevención de spoofing: si el token de guest tiene sessionId y se intenta usar otro sessionId explícito
      const explicitSessionId = (req.headers['x-session-id'] as string) || (req.body && req.body.sessionId);
      if (tokenClaims.sessionId && explicitSessionId && explicitSessionId !== tokenClaims.sessionId) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'No está autorizado para operar en una sesión distinta a la asignada en su token',
          },
        });
      }
      sessionId = tokenClaims.sessionId || explicitSessionId || sessionId;
    } else {
      // Staff puede proveer x-session-id explícito (header o body)
      sessionId = (req.headers['x-session-id'] as string) || (req.body && req.body.sessionId) || tokenClaims.sessionId || sessionId;
    }
  } else {
    // Si no vino token pero vino x-token-session-id vs x-session-id
    const tokenSessionHeader = req.headers['x-token-session-id'] as string;
    const isStaff = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER'].includes((role || '').toUpperCase());

    if (!isStaff && tokenSessionHeader && sessionId && tokenSessionHeader !== sessionId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'No está autorizado para operar en una sesión distinta a la asignada en su token',
        },
      });
    }

    if (isStaff) {
      sessionId = sessionId || (req.body && req.body.sessionId);
    }
  }

  if (!tenantId) {
    return res.status(401).json({
      error: { code: 'TENANT_REQUIRED', message: 'Falta cabecera x-tenant-id' },
    });
  }

  req.auth = {
    tenantId,
    role: role || (tokenClaims?.role) || 'guest',
    userId,
    sessionId,
  };

  // Rutas de carrito requieren sesión activa del guest o sesión explícita provista por staff
  if (req.path.startsWith('/cart') && !req.auth.sessionId) {
    return res.status(401).json({
      error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida para operaciones de carrito' },
    });
  }

  next();
}

