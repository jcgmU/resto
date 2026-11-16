import {
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  UserDTO,
  DomainError,
} from '@packages/shared-types';

export class ManageTeamUseCaseImpl {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async listUsers(tenantId: string): Promise<UserDTO[]> {
    return this.userRepo.listByTenant(tenantId);
  }

  async updateUser(input: {
    tenantId: string;
    currentUserId: string;
    targetUserId: string;
    displayName?: string;
    role?: 'MANAGER' | 'STAFF';
  }): Promise<UserDTO> {
    const userWithHash =
      (await this.userRepo.findWithPasswordById?.(input.targetUserId)) ||
      (await this.userRepo.findById(input.targetUserId) as any);

    if (!userWithHash || userWithHash.tenantId !== input.tenantId) {
      throw new DomainError('NOT_FOUND', 'Usuario no encontrado');
    }

    if (input.role) {
      if (input.targetUserId === input.currentUserId) {
        throw new DomainError('FORBIDDEN', 'El administrador no puede cambiar su propio rol');
      }
      if (input.role !== 'MANAGER' && input.role !== 'STAFF') {
        throw new DomainError('VALIDATION_ERROR', 'Rol debe ser MANAGER o STAFF');
      }
    }

    const updatedUser: UserDTO & { passwordHash: string } = {
      ...userWithHash,
      displayName: input.displayName !== undefined ? input.displayName.trim() : userWithHash.displayName,
      role: input.role !== undefined ? input.role : userWithHash.role,
      updatedAt: new Date(),
    };

    if (!updatedUser.displayName) {
      throw new DomainError('VALIDATION_ERROR', 'El nombre es requerido');
    }

    return this.userRepo.save(updatedUser);
  }

  async setStatus(input: {
    tenantId: string;
    currentUserId: string;
    targetUserId: string;
    status: 'ACTIVE' | 'DISABLED';
  }): Promise<UserDTO> {
    const userWithHash =
      (await this.userRepo.findWithPasswordById?.(input.targetUserId)) ||
      (await this.userRepo.findById(input.targetUserId) as any);

    if (!userWithHash || userWithHash.tenantId !== input.tenantId) {
      throw new DomainError('NOT_FOUND', 'Usuario no encontrado');
    }

    if (input.targetUserId === input.currentUserId && input.status === 'DISABLED') {
      throw new DomainError('FORBIDDEN', 'El administrador no puede desactivarse a sí mismo');
    }

    const updatedUser = {
      ...userWithHash,
      status: input.status,
      updatedAt: new Date(),
    };

    if (input.status === 'DISABLED') {
      await this.refreshTokenRepo.revokeAllForUser?.(input.targetUserId);
    }

    return this.userRepo.save(updatedUser);
  }

  async resetPassword(input: {
    tenantId: string;
    targetUserId: string;
    newPassword?: string;
  }): Promise<{ message: string; password?: string }> {
    const userWithHash =
      (await this.userRepo.findWithPasswordById?.(input.targetUserId)) ||
      (await this.userRepo.findById(input.targetUserId) as any);

    if (!userWithHash || userWithHash.tenantId !== input.tenantId) {
      throw new DomainError('NOT_FOUND', 'Usuario no encontrado');
    }

    const passwordToSet = input.newPassword || `Resto${Math.floor(100000 + Math.random() * 900000)}!`;
    if (passwordToSet.length < 8) {
      throw new DomainError('VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    const passwordHash = await this.passwordHasher.hash(passwordToSet);
    await this.userRepo.save({
      ...userWithHash,
      passwordHash,
      updatedAt: new Date(),
    });

    await this.refreshTokenRepo.revokeAllForUser?.(input.targetUserId);

    return { message: 'Contraseña restablecida exitosamente', password: passwordToSet };
  }
}
