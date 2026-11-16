import {
  InviteUserUseCase,
  InviteUserInput,
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

  async execute(input: InviteUserInput): Promise<UserDTO> {
    if (!input || !input.displayName || !input.displayName.trim()) {
      throw new DomainError('VALIDATION_ERROR', 'Display name is required');
    }

    const validRoles = ['MANAGER', 'STAFF', 'WAITER', 'MONITOR', 'CASHIER'];
    if (!input.role || !validRoles.includes(input.role)) {
      throw new DomainError('VALIDATION_ERROR', 'Role must be MANAGER or STAFF');
    }

    if (input.role === 'MONITOR') {
      if (!input.monitorKind || !['kitchen', 'bar'].includes(input.monitorKind)) {
        throw new DomainError('VALIDATION_ERROR', 'El tipo de monitor (kitchen o bar) es obligatorio para el rol MONITOR');
      }
      if (!input.password || !input.password.trim()) {
        throw new DomainError('VALIDATION_ERROR', 'La contraseña es requerida para el usuario MONITOR');
      }
    } else {
      const envMin = parseInt(process.env.MIN_ADMIN_PASSWORD_LENGTH || '', 10);
      const minPasswordLength = Number.isInteger(envMin) && envMin > 0 ? envMin : 8;
      if (!input.password || input.password.length < minPasswordLength) {
        throw new DomainError('VALIDATION_ERROR', 'Password must be at least 8 characters');
      }
    }

    const email = (input.email || '').trim().toLowerCase();
    const existing =
      (await this.userRepo.findByEmail(input.tenantId, email)) ||
      (await this.userRepo.findByEmail('', email));

    if (existing) {
      throw new DomainError('EMAIL_TAKEN', 'El email ya está registrado');
    }

    const passwordHash = await this.passwordHasher.hash(input.password!);
    const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const savedUser = await this.userRepo.save({
      id: userId,
      tenantId: input.tenantId,
      email,
      displayName: input.displayName.trim(),
      role: input.role,
      status: 'ACTIVE',
      passwordHash,
      monitorKind: input.role === 'MONITOR' ? (input.monitorKind as any) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { passwordHash: _hash, ...userDto } = savedUser as any;
    return userDto;
  }
}
