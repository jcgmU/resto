import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import { ManageTeamUseCaseImpl } from '../../src/application/ManageTeam';
import { DomainError } from '@packages/shared-types';

describe('ManageTeam Unit Tests', () => {
  let userRepo: InMemoryUserRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let useCase: ManageTeamUseCaseImpl;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    useCase = new ManageTeamUseCaseImpl(userRepo, refreshTokenRepo, passwordHasher);

    // Setup mock users
    userRepo.users = [
      {
        id: 'admin-1',
        tenantId: 'tenant-1',
        email: 'admin@t1.com',
        displayName: 'Admin T1',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: 'hashed_admin123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'staff-1',
        tenantId: 'tenant-1',
        email: 'staff@t1.com',
        displayName: 'Staff T1',
        role: 'STAFF',
        status: 'ACTIVE',
        passwordHash: 'hashed_staff123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'staff-2',
        tenantId: 'tenant-2',
        email: 'staff@t2.com',
        displayName: 'Staff T2',
        role: 'STAFF',
        status: 'ACTIVE',
        passwordHash: 'hashed_staff456',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    refreshTokenRepo.tokens = [
      {
        id: 'rt-1',
        userId: 'staff-1',
        tokenHash: 'hash_rt1',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      },
    ];
  });

  describe('listUsers', () => {
    it('lista usuarios del tenant sin incluir passwordHash', async () => {
      const list = await useCase.listUsers('tenant-1');
      expect(list).toHaveLength(2);
      expect(list.map((u) => u.id)).toEqual(['admin-1', 'staff-1']);
      expect((list[0] as any).passwordHash).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    it('actualiza displayName y role de un miembro del tenant', async () => {
      const updated = await useCase.updateUser({
        tenantId: 'tenant-1',
        currentUserId: 'admin-1',
        targetUserId: 'staff-1',
        displayName: 'Staff Modificado',
        role: 'MANAGER',
      });

      expect(updated.displayName).toBe('Staff Modificado');
      expect(updated.role).toBe('MANAGER');
      expect((updated as any).passwordHash).toBeUndefined();
    });

    it('prohibe que un admin cambie su propio rol (FORBIDDEN)', async () => {
      await expect(
        useCase.updateUser({
          tenantId: 'tenant-1',
          currentUserId: 'admin-1',
          targetUserId: 'admin-1',
          role: 'STAFF',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' } as Partial<DomainError>));
    });

    it('aislamiento: 404 al intentar modificar un usuario de otro tenant', async () => {
      await expect(
        useCase.updateUser({
          tenantId: 'tenant-1',
          currentUserId: 'admin-1',
          targetUserId: 'staff-2',
          displayName: 'Hacker',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>));
    });
  });

  describe('setStatus', () => {
    it('desactiva usuario y revoca sus refresh tokens', async () => {
      const disabled = await useCase.setStatus({
        tenantId: 'tenant-1',
        currentUserId: 'admin-1',
        targetUserId: 'staff-1',
        status: 'DISABLED',
      });

      expect(disabled.status).toBe('DISABLED');
      const token = refreshTokenRepo.tokens.find((t) => t.id === 'rt-1');
      expect(token?.revokedAt).not.toBeNull();
    });

    it('prohibe que el admin se auto-desactive (FORBIDDEN)', async () => {
      await expect(
        useCase.setStatus({
          tenantId: 'tenant-1',
          currentUserId: 'admin-1',
          targetUserId: 'admin-1',
          status: 'DISABLED',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' } as Partial<DomainError>));
    });

    it('reactiva a un usuario previamente desactivado', async () => {
      await useCase.setStatus({
        tenantId: 'tenant-1',
        currentUserId: 'admin-1',
        targetUserId: 'staff-1',
        status: 'DISABLED',
      });

      const enabled = await useCase.setStatus({
        tenantId: 'tenant-1',
        currentUserId: 'admin-1',
        targetUserId: 'staff-1',
        status: 'ACTIVE',
      });

      expect(enabled.status).toBe('ACTIVE');
    });

    it('aislamiento: 404 al intentar cambiar status a usuario de otro tenant', async () => {
      await expect(
        useCase.setStatus({
          tenantId: 'tenant-1',
          currentUserId: 'admin-1',
          targetUserId: 'staff-2',
          status: 'DISABLED',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>));
    });
  });

  describe('resetPassword', () => {
    it('restablece contraseña, revoca refresh tokens y devuelve nueva contraseña', async () => {
      const res = await useCase.resetPassword({
        tenantId: 'tenant-1',
        targetUserId: 'staff-1',
        newPassword: 'new-valid-password123',
      });

      expect(res.password).toBe('new-valid-password123');
      const user = userRepo.users.find((u) => u.id === 'staff-1');
      expect(user?.passwordHash).toBe('hashed_new-valid-password123');

      const token = refreshTokenRepo.tokens.find((t) => t.id === 'rt-1');
      expect(token?.revokedAt).not.toBeNull();
    });

    it('aislamiento: 404 al intentar resetear password de usuario de otro tenant', async () => {
      await expect(
        useCase.resetPassword({
          tenantId: 'tenant-1',
          targetUserId: 'staff-2',
          newPassword: 'newpassword123',
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' } as Partial<DomainError>));
    });
  });
});
