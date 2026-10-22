import {
  InviteUserUseCase,
  InviteUserInput,
  UserDTO,
  UserRepository,
  PasswordHasher,
  DomainError,
} from '@packages/shared-types';

export class InviteUserUseCaseImpl implements InviteUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher?: PasswordHasher
  ) {}

  async execute(input: InviteUserInput): Promise<UserDTO> {
    if (!input || !input.email || !input.email.trim()) {
      throw new DomainError('VALIDATION_ERROR', 'El email es obligatorio');
    }
    if (!input.displayName || !input.displayName.trim()) {
      throw new DomainError('VALIDATION_ERROR', 'El nombre es obligatorio');
    }

    const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER', 'MONITOR', 'CASHIER'];
    if (!input.role || !validRoles.includes(input.role)) {
      throw new DomainError('VALIDATION_ERROR', `Rol inválido: ${input.role}`);
    }

    if (input.role === 'MONITOR') {
      if (!input.monitorKind || !['kitchen', 'bar'].includes(input.monitorKind)) {
        throw new DomainError('VALIDATION_ERROR', 'El tipo de monitor (kitchen o bar) es obligatorio para el rol MONITOR');
      }
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(input.tenantId, email);
    if (existing) {
      throw new DomainError('EMAIL_TAKEN', `El email ${input.email} ya está registrado en este restaurante`);
    }

    let status: 'ACTIVE' | 'INVITED' = 'INVITED';
    let passwordHash = 'pending_invitation_hash';

    if (input.role === 'MONITOR') {
      if (!input.password || !input.password.trim()) {
        throw new DomainError('VALIDATION_ERROR', 'La contraseña es requerida para el usuario MONITOR');
      }
      if (!this.passwordHasher) {
        throw new Error('PasswordHasher no configurado en InviteUserUseCase');
      }
      passwordHash = await this.passwordHasher.hash(input.password);
      status = 'ACTIVE';
    } else if (input.role === 'WAITER' || input.role === 'CASHIER') {
      if (!input.password || !input.password.trim()) {
        throw new DomainError('VALIDATION_ERROR', `La contraseña es requerida para el rol ${input.role}`);
      }
      const envMin = parseInt(process.env.MIN_ADMIN_PASSWORD_LENGTH || '', 10);
      const minPasswordLength = Number.isInteger(envMin) && envMin > 0 ? envMin : 8;
      if (input.password.length < minPasswordLength) {
        throw new DomainError('VALIDATION_ERROR', `Password must be at least ${minPasswordLength} characters`);
      }
      if (!this.passwordHasher) {
        throw new Error('PasswordHasher no configurado en InviteUserUseCase');
      }
      passwordHash = await this.passwordHasher.hash(input.password);
      status = 'ACTIVE';
    } else if (input.password && input.password.trim()) {
      const envMin = parseInt(process.env.MIN_ADMIN_PASSWORD_LENGTH || '', 10);
      const minPasswordLength = Number.isInteger(envMin) && envMin > 0 ? envMin : 8;
      if (input.password.length < minPasswordLength) {
        throw new DomainError('VALIDATION_ERROR', `Password must be at least ${minPasswordLength} characters`);
      }
      if (!this.passwordHasher) {
        throw new Error('PasswordHasher no configurado en InviteUserUseCase');
      }
      passwordHash = await this.passwordHasher.hash(input.password);
      status = 'ACTIVE';
    }

    const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const savedUser = await this.userRepo.save({
      id: userId,
      tenantId: input.tenantId,
      email,
      displayName: input.displayName.trim(),
      role: input.role,
      status,
      passwordHash,
      monitorKind: input.role === 'MONITOR' ? (input.monitorKind as any) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return savedUser;
  }
}
