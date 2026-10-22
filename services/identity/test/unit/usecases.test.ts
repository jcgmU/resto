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

    test('4b. RegisterTenant con MIN_ADMIN_PASSWORD_LENGTH=4 acepta password de 5 caracteres', async () => {
      const originalEnv = process.env.MIN_ADMIN_PASSWORD_LENGTH;
      try {
        process.env.MIN_ADMIN_PASSWORD_LENGTH = '4';
        const useCase = new RegisterTenantUseCaseImpl(
          new InMemoryTenantRepository(),
          new InMemoryUserRepository(),
          new InMemoryRefreshTokenRepository(),
          new FakePasswordHasher(),
          new FakeTokenIssuer()
        );
        const result = await useCase.execute({
          restaurantName: 'La Pergola 4',
          adminEmail: 'admin@pergola4.com',
          adminPassword: 'admin',
          adminDisplayName: 'Admin Demo',
        });
        expect(result).toBeDefined();
        expect(result.user.role).toBe('ADMIN');
      } finally {
        if (originalEnv !== undefined) {
          process.env.MIN_ADMIN_PASSWORD_LENGTH = originalEnv;
        } else {
          delete process.env.MIN_ADMIN_PASSWORD_LENGTH;
        }
      }
    });

    test('4c. RegisterTenant con MIN_ADMIN_PASSWORD_LENGTH limpio o inválido exige mínimo por defecto 8', async () => {
      const originalEnv = process.env.MIN_ADMIN_PASSWORD_LENGTH;
      try {
        delete process.env.MIN_ADMIN_PASSWORD_LENGTH;
        const useCase = new RegisterTenantUseCaseImpl(
          new InMemoryTenantRepository(),
          new InMemoryUserRepository(),
          new InMemoryRefreshTokenRepository(),
          new FakePasswordHasher(),
          new FakeTokenIssuer()
        );
        await expect(
          useCase.execute({
            restaurantName: 'La Pergola Default',
            adminEmail: 'short@pergola.com',
            adminPassword: 'admin',
            adminDisplayName: 'Admin Short',
          })
        ).rejects.toThrow(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters',
          } as Partial<DomainError>)
        );

        // Test con valor inválido ('invalid' o '0')
        process.env.MIN_ADMIN_PASSWORD_LENGTH = 'not-a-number';
        await expect(
          useCase.execute({
            restaurantName: 'La Pergola Invalid',
            adminEmail: 'short2@pergola.com',
            adminPassword: 'admin',
            adminDisplayName: 'Admin Short 2',
          })
        ).rejects.toThrow(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters',
          } as Partial<DomainError>)
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.MIN_ADMIN_PASSWORD_LENGTH = originalEnv;
        } else {
          delete process.env.MIN_ADMIN_PASSWORD_LENGTH;
        }
      }
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
    test('7. RefreshSession con refresh válido -> nuevo par de tokens Y el refresh anterior queda revocado (rotación)', async () => {
      const useCase = new RefreshSessionUseCaseImpl(new InMemoryUserRepository(), new InMemoryRefreshTokenRepository(), new FakeTokenIssuer());
      const tokens = await useCase.execute({ refreshToken: 'valid-refresh-token' });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
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
    test('9. InviteUser crea usuario MANAGER/STAFF en el tenant del admin autenticado', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository());
      const user = await useCase.execute({
        tenantId: 'tenant-123',
        email: 'staff@resto.com',
        displayName: 'Mesero Juan',
        role: 'STAFF',
      });

      expect(user.tenantId).toBe('tenant-123');
      expect(user.role).toBe('STAFF');
      expect(user.status).toBe('INVITED');
    });

    test('10. InviteUser ignora cualquier tenantId del input: siempre usa el del token', async () => {
      const useCase = new InviteUserUseCaseImpl(new InMemoryUserRepository());
      const user = await useCase.execute({
        tenantId: 'tenant-from-token',
        email: 'manager@resto.com',
        displayName: 'Gerente Ana',
        role: 'MANAGER',
      });

      expect(user.tenantId).toBe('tenant-from-token');
    });

    test('9b. InviteUser con rol WAITER y password crea usuario ACTIVE con password hasheado', async () => {
      const userRepo = new InMemoryUserRepository();
      const hasher = new FakePasswordHasher();
      const useCase = new InviteUserUseCaseImpl(userRepo, hasher);
      const user = await useCase.execute({
        tenantId: 'tenant-123',
        email: 'waiter@resto.com',
        displayName: 'Carlos Mesero',
        role: 'WAITER',
        password: 'password123',
      });

      expect(user.role).toBe('WAITER');
      expect(user.status).toBe('ACTIVE');
      expect(user.displayName).toBe('Carlos Mesero');

      const savedWithPass = await userRepo.findWithPasswordByEmail('tenant-123', 'waiter@resto.com');
      expect(savedWithPass?.passwordHash).toBe('hashed_password123');
    });

    test('9b2. InviteUser con rol WAITER o CASHIER y password corta (< 8) -> VALIDATION_ERROR', async () => {
      const userRepo = new InMemoryUserRepository();
      const hasher = new FakePasswordHasher();
      const useCase = new InviteUserUseCaseImpl(userRepo, hasher);

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'waiter.short@resto.com',
          displayName: 'Mesero Corto',
          role: 'WAITER',
          password: 'short',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>));

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'caja.short@resto.com',
          displayName: 'Caja Corta',
          role: 'CASHIER',
          password: 'short',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>));
    });

    test('9c. InviteUser con rol CASHIER crea usuario ACTIVE con rol CASHIER', async () => {
      const userRepo = new InMemoryUserRepository();
      const hasher = new FakePasswordHasher();
      const useCase = new InviteUserUseCaseImpl(userRepo, hasher);
      const user = await useCase.execute({
        tenantId: 'tenant-123',
        email: 'cajero@resto.com',
        displayName: 'Laura Cajera',
        role: 'CASHIER',
        password: 'password123',
      });

      expect(user.role).toBe('CASHIER');
      expect(user.status).toBe('ACTIVE');
    });

    test('9c2. InviteUser con rol MONITOR requiere monitorKind y password', async () => {
      const userRepo = new InMemoryUserRepository();
      const hasher = new FakePasswordHasher();
      const useCase = new InviteUserUseCaseImpl(userRepo, hasher);

      // Sin monitorKind -> error
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'monitor1@resto.com',
          displayName: 'Pantalla Cocina',
          role: 'MONITOR',
          password: '123',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>));

      // Sin password -> error
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'monitor2@resto.com',
          displayName: 'Pantalla Bar',
          role: 'MONITOR',
          monitorKind: 'bar',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>));

      // Con monitorKind y password corta (sin política especial de longitud para monitor) -> éxito
      const okUser = await useCase.execute({
        tenantId: 'tenant-123',
        email: 'monitor.ok@resto.com',
        displayName: 'Monitor Barra',
        role: 'MONITOR',
        monitorKind: 'bar',
        password: '123',
      });
      expect(okUser.role).toBe('MONITOR');
      expect(okUser.status).toBe('ACTIVE');
      expect(okUser.monitorKind).toBe('bar');
    });

    test('9d. InviteUser sin displayName -> VALIDATION_ERROR', async () => {
      const userRepo = new InMemoryUserRepository();
      const useCase = new InviteUserUseCaseImpl(userRepo);
      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          email: 'noname@resto.com',
          displayName: '  ',
          role: 'WAITER',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' } as Partial<DomainError>));
    });

    test('9e. Login de usuario creado con password devuelve tokens y displayName en user', async () => {
      const tenantRepo = new InMemoryTenantRepository();
      const userRepo = new InMemoryUserRepository();
      const refreshTokenRepo = new InMemoryRefreshTokenRepository();
      const hasher = new FakePasswordHasher();
      const issuer = new FakeTokenIssuer();

      const inviteCase = new InviteUserUseCaseImpl(userRepo, hasher);
      await inviteCase.execute({
        tenantId: 'tenant-default',
        email: 'mesero.login@resto.com',
        displayName: 'Pedro Mesero',
        role: 'WAITER',
        password: 'mypassword',
      });

      const loginCase = new LoginUseCaseImpl(tenantRepo, userRepo, refreshTokenRepo, hasher, issuer);
      const res = await loginCase.execute({
        email: 'mesero.login@resto.com',
        password: 'mypassword',
      });

      expect(res.user.role).toBe('WAITER');
      expect(res.user.displayName).toBe('Pedro Mesero');
      expect(res.tokens.accessToken).toBeDefined();
    });
  });
});
