import {
  LoginUseCase,
  UserDTO,
  AuthTokens,
  TenantRepository,
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  TokenIssuer,
  DomainError,
} from '@packages/shared-types';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
  FakeTokenIssuer,
} from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class LoginUseCaseImpl implements LoginUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer
  ) {}

  async execute(input: {
    email: string;
    password: string;
    tenantSlug?: string;
  }): Promise<{ user: UserDTO; tokens: AuthTokens }> {
    if (
      !input ||
      !input.email ||
      !input.password ||
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      !input.email.trim() ||
      !input.password.trim()
    ) {
      throw new DomainError('VALIDATION_ERROR', 'Email y contraseña requeridos');
    }

    let tenantId = '';
    if (input.tenantSlug) {
      const tenant = await this.tenantRepo.findBySlug(input.tenantSlug);
      if (!tenant) {
        throw new DomainError('INVALID_CREDENTIALS', 'Credenciales invalidas');
      }
      tenantId = tenant.id;
    }

    const userWithHash = await this.userRepo.findWithPasswordByEmail(tenantId, input.email);
    if (!userWithHash) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales invalidas');
    }

    const hashToVerify = userWithHash.passwordHash;
    const isValid = await this.passwordHasher.verify(input.password, hashToVerify);
    if (!isValid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Credenciales invalidas');
    }

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: userWithHash.id,
      tenantId: userWithHash.tenantId,
      role: userWithHash.role,
      email: userWithHash.email,
      displayName: userWithHash.displayName || userWithHash.email,
    });

    const refresh = this.tokenIssuer.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save(userWithHash.id, refresh.hash, expiresAt);

    const { passwordHash, ...cleanUser } = userWithHash;

    return {
      user: cleanUser,
      tokens: {
        accessToken,
        refreshToken: refresh.raw,
        expiresIn: 900,
      },
    };
  }
}
