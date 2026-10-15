import {
  RegisterTenantUseCase,
  RegisterTenantRequest,
  RegisterTenantResult,
  TenantRepository,
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  TokenIssuer,
  TenantDTO,
  DomainError,
} from '@packages/shared-types';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
  FakeTokenIssuer,
} from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class RegisterTenantUseCaseImpl implements RegisterTenantUseCase {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer
  ) {}

  async execute(input: RegisterTenantRequest): Promise<RegisterTenantResult> {
    const envMin = parseInt(process.env.MIN_ADMIN_PASSWORD_LENGTH || '', 10);
    const minPasswordLength = Number.isInteger(envMin) && envMin > 0 ? envMin : 8;
    if (!input.adminPassword || input.adminPassword.length < minPasswordLength) {
      throw new DomainError('VALIDATION_ERROR', `Password must be at least ${minPasswordLength} characters`);
    }

    const slug = input.slug
      ? input.slug
      : input.restaurantName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

    const existingTenant = await this.tenantRepo.findBySlug(slug);
    if (existingTenant) {
      throw new DomainError('SLUG_TAKEN', `El slug "${slug}" ya está registrado`);
    }

    const tenantId = `tenant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const existingUser =
      (await this.userRepo.findByEmail(tenantId, input.adminEmail)) ||
      (await this.userRepo.findByEmail('', input.adminEmail));

    if (existingUser) {
      throw new DomainError('EMAIL_TAKEN', `El email "${input.adminEmail}" ya está registrado`);
    }

    const tenant: TenantDTO = {
      id: tenantId,
      name: input.restaurantName,
      slug,
      status: 'ACTIVE',
      operatingMode: 'hybrid',
      estimatedPrepMinutes: 18,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedTenant = await this.tenantRepo.save(tenant);
    const passwordHash = await this.passwordHasher.hash(input.adminPassword);

    const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const savedUser = await this.userRepo.save({
      id: userId,
      tenantId: savedTenant.id,
      email: input.adminEmail,
      displayName: input.adminDisplayName,
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const accessToken = this.tokenIssuer.issueAccessToken({
      sub: savedUser.id,
      tenantId: savedTenant.id,
      role: savedUser.role,
      email: savedUser.email,
    });

    const refresh = this.tokenIssuer.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save(savedUser.id, refresh.hash, expiresAt);

    return {
      tenant: savedTenant,
      user: savedUser,
      tokens: {
        accessToken,
        refreshToken: refresh.raw,
        expiresIn: 900,
      },
    };
  }
}
