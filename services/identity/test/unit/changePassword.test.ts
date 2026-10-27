import {
  InMemoryUserRepository,
  InMemoryRefreshTokenRepository,
  FakePasswordHasher,
} from '../../src/infrastructure/fakes/InMemoryIdentityAdapters';
import { ChangePasswordUseCaseImpl } from '../../src/application/ChangePassword';
import { DomainError } from '@packages/shared-types';

describe('ChangePasswordUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let refreshTokenRepo: InMemoryRefreshTokenRepository;
  let passwordHasher: FakePasswordHasher;
  let useCase: ChangePasswordUseCaseImpl;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    refreshTokenRepo = new InMemoryRefreshTokenRepository();
    passwordHasher = new FakePasswordHasher();
    useCase = new ChangePasswordUseCaseImpl(userRepo, refreshTokenRepo, passwordHasher);
  });

  test('Cambio exitoso con credenciales correctas', async () => {
    await useCase.execute({
      userId: 'u-valid',
      currentPassword: 'validpassword',
      newPassword: 'newpassword123',
    });

    const userWithPassword = await userRepo.findWithPasswordById('u-valid');
    expect(userWithPassword).toBeDefined();
    expect(userWithPassword?.passwordHash).toBe('hashed_newpassword123');

    const isOldValid = await passwordHasher.verify('validpassword', userWithPassword!.passwordHash);
    expect(isOldValid).toBe(false);

    const isNewValid = await passwordHasher.verify('newpassword123', userWithPassword!.passwordHash);
    expect(isNewValid).toBe(true);
  });

  test('Contraseña actual incorrecta lanza INVALID_CREDENTIALS', async () => {
    await expect(
      useCase.execute({
        userId: 'u-valid',
        currentPassword: 'wrong-password',
        newPassword: 'newpassword123',
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'INVALID_CREDENTIALS',
        message: 'Contraseña actual incorrecta',
      } as Partial<DomainError>)
    );

    const userWithPassword = await userRepo.findWithPasswordById('u-valid');
    expect(userWithPassword?.passwordHash).toBe('hashed_validpassword');
  });

  test('Nueva contraseña menor a 8 caracteres lanza VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        userId: 'u-valid',
        currentPassword: 'validpassword',
        newPassword: 'short',
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters',
      } as Partial<DomainError>)
    );

    const userWithPassword = await userRepo.findWithPasswordById('u-valid');
    expect(userWithPassword?.passwordHash).toBe('hashed_validpassword');
  });

  test('Revocación de refresh tokens al cambiar la contraseña', async () => {
    const validTokenBefore = await refreshTokenRepo.findValidByHash('hash_valid-refresh-token');
    expect(validTokenBefore).not.toBeNull();
    expect(validTokenBefore?.userId).toBe('u-valid');

    await useCase.execute({
      userId: 'u-valid',
      currentPassword: 'validpassword',
      newPassword: 'newpassword123',
    });

    const validTokenAfter = await refreshTokenRepo.findValidByHash('hash_valid-refresh-token');
    expect(validTokenAfter).toBeNull();

    const userTokens = refreshTokenRepo.tokens.filter((t) => t.userId === 'u-valid');
    expect(userTokens.length).toBeGreaterThan(0);
    expect(userTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  test('Usuario no encontrado lanza NOT_FOUND', async () => {
    await expect(
      useCase.execute({
        userId: 'non-existent-user',
        currentPassword: 'validpassword',
        newPassword: 'newpassword123',
      })
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Usuario no encontrado',
      } as Partial<DomainError>)
    );
  });
});
