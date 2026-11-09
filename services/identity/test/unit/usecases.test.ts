import { InMemoryTenantRepository, InMemoryUserRepository, InMemoryRefreshTokenRepository, FakePasswordHasher, FakeTokenIssuer } from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import {
  RegisterTenantUseCaseImpl,
} from '../../src/application/RegisterTenant';
import {
  LoginUseCaseImpl,
} from '../../src/application/Login';
import {
  RefreshSessionUseCaseImpl,
} from '../../src/application/RefreshSession';
import {
  InviteUserUseCaseImpl,
} from '../../src/application/InviteUser';
import { DomainError } from '@packages/shared-types';

describe('A. Identity — unitarios de casos de uso (Tests 1-10)', () => {
  describe('RegisterTenant (Tests 1-4)', () => {
    test('1. RegisterTenant crea tenant + usuario ADMIN y devuelve tokens', async () => {
      const useCase = new RegisterTenantUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      const result = await useCase.execute({
        restaurantName: 'La Pergola',
        adminEmail: 'admin@pergola.com',
        adminPassword: 'password123',
        adminDisplayName: 'Don Pergola',
      });

      expect(result).toBeDefined();
      expect(result.tenant.name).toBe('La Pergola');
      expect(result.user.role).toBe('ADMIN');
      expect(result.tokens.accessToken).toBeDefined();
    });

    test('2. RegisterTenant con email ya usado en ese tenant -> EMAIL_TAKEN', async () => {
      const useCase = new RegisterTenantUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      await expect(
        useCase.execute({
          restaurantName: 'La Pergola',
          adminEmail: 'taken@pergola.com',
          adminPassword: 'password123',
          adminDisplayName: 'Admin Taken',
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'EMAIL_TAKEN' } as Partial<DomainError>)
      );
    });

    test('3. RegisterTenant con slug tomado -> SLUG_TAKEN', async () => {
      const useCase = new RegisterTenantUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      await expect(
        useCase.execute({
          restaurantName: 'La Pergola',
          slug: 'pergola-duplicada',
          adminEmail: 'unique@pergola.com',
          adminPassword: 'password123',
          adminDisplayName: 'Admin Slug',
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'SLUG_TAKEN' } as Partial<DomainError>)
      );
    });

    test('4. RegisterTenant con password < 8 caracteres -> VALIDATION_ERROR', async () => {
      const useCase = new RegisterTenantUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      await expect(
        useCase.execute({
          restaurantName: 'La Pergola',
          adminEmail: 'short@pergola.com',
          adminPassword: 'short',
          adminDisplayName: 'Admin Short',
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>)
      );
    });
  });

  describe('Login (Tests 5-6)', () => {
    test('5. Login con credenciales válidas -> tokens + UserDTO sin passwordHash', async () => {
      const useCase = new LoginUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      const result = await useCase.execute({
        email: 'user@resto.com',
        password: 'validpassword',
      });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.user.email).toBe('user@resto.com');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    test('6. Login con password erróneo o email inexistente -> mismo INVALID_CREDENTIALS en ambos casos', async () => {
      const useCase = new LoginUseCaseImpl(new InMemoryTenantRepository(), new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakePasswordHasher(), new FakeTokenIssuer());
      await expect(
        useCase.execute({
          email: 'nonexistent@resto.com',
          password: 'password',
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' } as Partial<DomainError>)
      );

      await expect(
        useCase.execute({
          email: 'user@resto.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' } as Partial<DomainError>)
      );
    });
  });

  describe('RefreshSession (Tests 7-8)', () => {
    test('7. RefreshSession con refresh válido -> nuevo par de tokens Y el refresh anterior queda revocado (rotación secuencial)', async () => {
      const refreshRepo = new InMemoryRefreshTokenRepository();
      const useCase = new RefreshSessionUseCaseImpl(new InMemoryUserRepository(), refreshRepo, new FakeTokenIssuer());
      const tokens = await useCase.execute({ refreshToken: 'valid-refresh-token' });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // El refresh anterior queda revocado (replay rechazado)
      await expect(
        useCase.execute({ refreshToken: 'valid-refresh-token' })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' } as Partial<DomainError>)
      );

      // El nuevo refreshToken emitido por rotación es aceptado secuencialmente
      const nextTokens = await useCase.execute({ refreshToken: tokens.refreshToken });
      expect(nextTokens.accessToken).toBeDefined();
      expect(nextTokens.refreshToken).toBeDefined();
    });

    test('8. RefreshSession con refresh revocado o expirado -> INVALID_CREDENTIALS', async () => {
      const useCase = new RefreshSessionUseCaseImpl(new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakeTokenIssuer());
      await expect(
        useCase.execute({ refreshToken: 'expired-or-revoked-token' })
      ).rejects.toThrow(
        expect.objectContaining({ code: 'INVALID_CREDENTIALS' } as Partial<DomainError>)
      );
    });
  });

  describe('InviteUser (Tests 9-10)', () => {
    test('9. InviteUser crea usuario MANAGER/STAFF con status ACTIVE y password hasheado', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      const user = await useCase.execute({
        tenantId: 'tenant-123',
        email: 'staff@resto.com',
        displayName: 'Mesero Juan',
        password: 'password123',
        role: 'STAFF',
      });

      expect(user.tenantId).toBe('tenant-123');
      expect(user.role).toBe('STAFF');
      expect(user.status).toBe('ACTIVE');
      expect((user as any).passwordHash).toBeUndefined();
    });

    test('10. InviteUser ignora cualquier tenantId del input: siempre usa el del token', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      const user = await useCase.execute({
        tenantId: 'tenant-from-token',
        email: 'manager@resto.com',
        displayName: 'Gerente Ana',
        password: 'password123',
        role: 'MANAGER',
      });

      expect(user.tenantId).toBe('tenant-from-token');
      expect(user.role).toBe('MANAGER');
      expect(user.status).toBe('ACTIVE');
    });

    test('10b. InviteUser rechaza rol inválido (ADMIN o CUSTOMER) -> VALIDATION_ERROR', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'admin2@resto.com',
          displayName: 'Otro Admin',
          password: 'password123',
          role: 'ADMIN' as any,
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Role must be MANAGER or STAFF',
        } as Partial<DomainError>)
      );

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'customer@resto.com',
          displayName: 'Cliente',
          password: 'password123',
          role: 'CUSTOMER' as any,
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Role must be MANAGER or STAFF',
        } as Partial<DomainError>)
      );
    });

    test('10c. InviteUser rechaza password corto (< 8 caracteres) o faltante -> VALIDATION_ERROR', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'shortpass@resto.com',
          displayName: 'Short Pass',
          password: 'short',
          role: 'STAFF',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters',
        } as Partial<DomainError>)
      );

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'nopass@resto.com',
          displayName: 'No Pass',
          role: 'STAFF',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters',
        } as Partial<DomainError>)
      );
    });

    test('10d. InviteUser rechaza displayName vacío -> VALIDATION_ERROR', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'noname@resto.com',
          displayName: '   ',
          password: 'password123',
          role: 'STAFF',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Display name is required',
        } as Partial<DomainError>)
      );
    });

    test('10e. InviteUser comprueba unicidad de email global -> EMAIL_TAKEN', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository(), new FakePasswordHasher());
      // 'user@resto.com' already exists in tenant-default
      await expect(
        useCase.execute({
          tenantId: 'tenant-different',
          email: 'user@resto.com',
          displayName: 'Mesero Clon',
          password: 'password123',
          role: 'STAFF',
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_TAKEN',
          message: 'El email ya está registrado',
        } as Partial<DomainError>)
      );
    });
  });
});
