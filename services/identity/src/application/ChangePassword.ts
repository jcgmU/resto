import {
  ChangePasswordUseCase,
  UserRepository,
  RefreshTokenRepository,
  PasswordHasher,
  DomainError,
} from '@packages/shared-types';

export class ChangePasswordUseCaseImpl implements ChangePasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    if (!input.newPassword || input.newPassword.length < 8) {
      throw new DomainError('VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    const user = this.userRepo.findWithPasswordById
      ? await this.userRepo.findWithPasswordById(input.userId)
      : ((await this.userRepo.findById(input.userId)) as any);

    if (!user) {
      throw new DomainError('NOT_FOUND', 'Usuario no encontrado');
    }

    const isValid = await this.passwordHasher.verify(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Contraseña actual incorrecta');
    }

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepo.save({
      ...user,
      passwordHash: newHash,
    });

    if (this.refreshTokenRepo.revokeAllForUser) {
      await this.refreshTokenRepo.revokeAllForUser(input.userId);
    }
  }
}
