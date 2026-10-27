import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
  FakeTokenIssuer,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import { RegisterTenantUseCaseImpl } from '../../src/application/RegisterTenant';
import { LoginUseCaseImpl } from '../../src/application/Login';
import { RefreshSessionUseCaseImpl } from '../../src/application/RefreshSession';
import { DomainError } from '@packages/shared-types';

describe('Login status validation and RegisterTenant atomicity', () => {
  describe('LoginUseCase status check', () => {
    test('Login con usuario DISABLED lanza INVALID_CREDENTIALS', async () => {
      const tenantRepo = new InMemoryTenantRepository();
      const userRepo = new InMemoryUserRepository();
      userRepo.users.push({
        id: 'u-disabled',
        tenantId: 'tenant-default',
        email: 'disabled@resto.com',
        displayName: 'Disabled User',
        role: 'STAFF',
        status: 'DISABLED',
        passwordHash: 'hashed_password123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const loginUseCase = new LoginUseCaseImpl(
        tenantRepo,
        userRepo,
        new InMemoryRefreshTokenRepository(),
        new FakePasswordHasher(),
        new FakeTokenIssuer()
      );

      await expect(
        loginUseCase.execute({
          email: 'disabled@resto.com',
          password: 'password123',
          tenantSlug: 'default-tenant',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
        } as Partial<DomainError>)
      );
    });
  });

  describe('RefreshSessionUseCase status check', () => {
    test('RefreshSession con usuario DISABLED lanza INVALID_CREDENTIALS', async () => {
      const userRepo = new InMemoryUserRepository();
      userRepo.users.push({
        id: 'u-disabled-refresh',
        tenantId: 'tenant-default',
        email: 'disabled-refresh@resto.com',
        displayName: 'Disabled Refresh User',
        role: 'STAFF',
        status: 'DISABLED',
        passwordHash: 'hashed_password123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const refreshTokenRepo = new InMemoryRefreshTokenRepository();
      refreshTokenRepo.tokens.push({
        id: 'rt-disabled',
        userId: 'u-disabled-refresh',
        tokenHash: 'hash_disabled-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      const refreshUseCase = new RefreshSessionUseCaseImpl(
        userRepo,
        refreshTokenRepo,
        new FakeTokenIssuer()
      );

      await expect(
        refreshUseCase.execute({
          refreshToken: 'disabled-token',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
        } as Partial<DomainError>)
      );
    });
  });

  describe('RegisterTenant atomicity and defaults', () => {
    test('Register sin adminDisplayName no falla y asigna restaurantName', async () => {
      const tenantRepo = new InMemoryTenantRepository();
      const userRepo = new InMemoryUserRepository();
      const registerUseCase = new RegisterTenantUseCaseImpl(
        tenantRepo,
        userRepo,
        new InMemoryRefreshTokenRepository(),
        new FakePasswordHasher(),
        new FakeTokenIssuer()
      );

      const result = await registerUseCase.execute({
        restaurantName: 'Bistró Central',
        adminEmail: 'bistro@central.com',
        adminPassword: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.tenant.name).toBe('Bistró Central');
      expect(result.user.displayName).toBe('Bistró Central');
    });

    test('Register con fallo posterior limpia el tenant (no queda tenant huérfano)', async () => {
      const tenantRepo = new InMemoryTenantRepository();
      const userRepo = new InMemoryUserRepository();

      jest.spyOn(userRepo, 'save').mockRejectedValueOnce(new Error('Simulated DB failure saving admin user'));

      const registerUseCase = new RegisterTenantUseCaseImpl(
        tenantRepo,
        userRepo,
        new InMemoryRefreshTokenRepository(),
        new FakePasswordHasher(),
        new FakeTokenIssuer()
      );

      await expect(
        registerUseCase.execute({
          restaurantName: 'Resto Huérfano',
          slug: 'resto-huerfano',
          adminEmail: 'admin@huerfano.com',
          adminPassword: 'password123',
        })
      ).rejects.toThrow('Simulated DB failure saving admin user');

      const orphanTenant = await tenantRepo.findBySlug('resto-huerfano');
      expect(orphanTenant).toBeNull();
    });
  });
});
