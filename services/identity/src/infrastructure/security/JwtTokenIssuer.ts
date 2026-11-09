import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TokenIssuer, AccessTokenClaims } from '@packages/shared-types';

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly secret = process.env.JWT_SECRET || 'super-secret-jwt-key-oleada-0') {}

  issueAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>): string {
    return jwt.sign(claims, this.secret, { expiresIn: '15m' });
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = hashRefreshToken(raw);
    return { raw, hash };
  }
}
