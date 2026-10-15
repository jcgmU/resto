import {
  RefreshSessionUseCase,
  AuthTokens,
  UserRepository,
  RefreshTokenRepository,
  TokenIssuer,
  DomainError,
} from '@packages/shared-types';
import { hashRefreshToken } from '../infrastructure/security/tokenHash';

export class RefreshSessionUseCaseImpl implements RefreshSessionUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tokenIssuer: TokenIssuer
  ) {}

  async execute(input: { refreshToken: string }): Promise<AuthTokens> {
    if (!input.refreshToken) {
      throw new DomainError('INVALID_CREDENTIALS', 'Token de refresco requerido');
    }

    const tokenHash = hashRefreshToken(input.refreshToken);
    const newRefresh = this.tokenIssuer.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { userId } = await this.refreshTokenRepo.rotate(tokenHash, {
      tokenHash: newRefresh.hash,
      expiresAt,
    });

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Usuario no encontrado');
    }

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: newRefresh.raw,
      expiresIn: 900,
    };
  }
}
