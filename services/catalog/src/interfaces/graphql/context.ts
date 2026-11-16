import { Request } from 'express';
import { GraphQLError } from 'graphql';
import crypto from 'crypto';

export interface CatalogContext {
  tenantId: string;
  userId?: string;
  role?: string;
  sessionId?: string;
  isGuest?: boolean;
}

function verifyJwtPayload(token: string): any | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    // Strict HS256 algorithm enforcement
    let header: any;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
      return null;
    }

    // Cryptographic signature verification using constant-time comparison
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    // Parse payload and enforce expiration (fail-closed)
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }
    if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > now)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function buildCatalogContext({ req }: { req: Request }): Promise<CatalogContext> {
  let tenantId = (req.headers['x-tenant-id'] as string) || undefined;
  const rawUserId = req.headers['x-user-id'];
  let userId = typeof rawUserId === 'string' ? rawUserId : Array.isArray(rawUserId) ? rawUserId[0] : undefined;

  const rawSessionId = req.headers['x-session-id'];
  let sessionId = typeof rawSessionId === 'string' ? rawSessionId : Array.isArray(rawSessionId) ? rawSessionId[0] : undefined;

  let verifiedRole: string | undefined;
  let isGuestFromJwt = false;

  // Process Authorization header strictly fail-closed
  const authHeader = req.headers['authorization'];
  if (authHeader !== undefined) {
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new GraphQLError('UNAUTHENTICATED', {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      });
    }
    const token = authHeader.substring(7).trim();
    const payload = verifyJwtPayload(token);
    if (!payload) {
      throw new GraphQLError('UNAUTHENTICATED', {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      });
    }

    if (!tenantId && payload.tenantId) {
      tenantId = payload.tenantId;
    }
    if (!sessionId && payload.sessionId) {
      sessionId = payload.sessionId;
    }
    if (!userId && (payload.userId || payload.sub)) {
      userId = payload.userId || payload.sub;
    }
    if (payload.sessionId || (payload.role && String(payload.role).toLowerCase() === 'guest')) {
      isGuestFromJwt = true;
    } else if (payload.role) {
      verifiedRole = String(payload.role).trim().toUpperCase();
    }
  }

  // Raw role headers (x-user-role, x-role) are NEVER trusted for privileged roles (ADMIN, MANAGER, STAFF).
  // A privileged role can only be granted by a cryptographically verified JWT.
  // Raw guest indicators (x-session-id or explicit guest header) are accepted only to enforce guest demotion.
  const rawUserRole = req.headers['x-user-role'];
  const rawRoleStr = typeof rawUserRole === 'string' ? rawUserRole : Array.isArray(rawUserRole) ? rawUserRole[0] : undefined;
  const isGuestHeader = rawRoleStr && rawRoleStr.trim().toLowerCase() === 'guest';

  const isGuest = Boolean(
    sessionId ||
    isGuestFromJwt ||
    isGuestHeader
  );

  let role: string | undefined;
  if (isGuest) {
    role = 'GUEST';
  } else if (verifiedRole) {
    role = verifiedRole;
  }

  if (!tenantId) {
    throw new GraphQLError('UNAUTHENTICATED', {
      extensions: {
        code: 'UNAUTHENTICATED',
      },
    });
  }

  return {
    tenantId,
    userId,
    role,
    sessionId,
    isGuest,
  };
}
