import {
  InviteUserUseCase,
  UserDTO,
  UserRepository,
  PasswordHasher,
  DomainError,
} from '@packages/shared-types';
import { FakePasswordHasher } from '../infrastructure/fakes/InMemoryIdentityAdapters';

export class InviteUserUseCaseImpl implements InviteUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher = new FakePasswordHasher()
  ) {}

  async execute(input: {
    tenantId: string;
    email: string;
    displayName: string;
    password?: string;
    role: 'MANAGER' | 'STAFF';
  }): Promise<UserDTO> {
    if (!input.displayName || !input.displayName.trim()) {
      throw new DomainError('VALIDATION_ERROR', 'Display name is required');
    }

    if (input.role !== 'MANAGER' && input.role !== 'STAFF') {
      throw new DomainError('VALIDATION_ERROR', 'Role must be MANAGER or STAFF');
    }

    if (!input.password || input.password.length < 8) {
      throw new DomainError('VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    const existing = await this.userRepo.findByEmail('', input.email);
    if (existing) {
      throw new DomainError('EMAIL_TAKEN', 'El email ya está registrado');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const savedUser = await this.userRepo.save({
      id: userId,
      tenantId: input.tenantId,
      email: input.email,
      displayName: input.displayName.trim(),
      role: input.role,
      status: 'ACTIVE',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { passwordHash: _hash, ...userDto } = savedUser as any;
    return userDto;
  }
}
