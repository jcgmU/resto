import crypto from 'crypto';
import {
  OpenSessionRequest,
  OpenSessionResult,
  TableSessionDTO,
  TableSessionRepository,
  TableRepository,
  GuestTokenIssuer,
  DomainError,
} from '@packages/shared-types';

export class OpenTableSessionUseCaseImpl {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly tableRepo: TableRepository,
    private readonly tokenIssuer: GuestTokenIssuer,
    private readonly ttlSeconds: number = 14400
  ) {}

  async execute(input: OpenSessionRequest): Promise<OpenSessionResult> {
    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table || table.status === 'deleted') {
      throw new DomainError('TABLE_NOT_FOUND', `TABLE_NOT_FOUND: Mesa ${input.tableId} no encontrada`);
    }

    if (table.status !== 'active') {
      throw new DomainError('TABLE_INACTIVE', `TABLE_INACTIVE: Mesa ${input.tableId} inactiva`);
    }

    if (table.qrKey !== input.qrKey) {
      throw new DomainError('QR_KEY_INVALID', 'QR_KEY_INVALID: Código QR inválido');
    }

    const existing = await this.sessionRepo.findActiveByTable(input.tenantId, input.tableId);
    if (existing) {
      await this.sessionRepo.touch(input.tenantId, existing.sessionId, this.ttlSeconds);
      const guestToken = this.tokenIssuer.issue(
        { tenantId: input.tenantId, sessionId: existing.sessionId, role: 'guest' },
        this.ttlSeconds
      );
      return { session: existing, guestToken };
    }

    const now = new Date();
    const sessionId = `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const session: TableSessionDTO = {
      sessionId,
      tenantId: input.tenantId,
      tableId: input.tableId,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlSeconds * 1000).toISOString(),
    };

    const saved = await this.sessionRepo.save(input.tenantId, session, this.ttlSeconds);
    const guestToken = this.tokenIssuer.issue(
      { tenantId: input.tenantId, sessionId: saved.sessionId, role: 'guest' },
      this.ttlSeconds
    );

    return { session: saved, guestToken };
  }
}

export class CloseTableSessionUseCaseImpl {
  constructor(private readonly sessionRepo: TableSessionRepository) {}

  async execute(input: { tenantId: string; sessionId: string }): Promise<TableSessionDTO> {
    const session = await this.sessionRepo.findById(input.tenantId, input.sessionId);
    if (!session) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${input.sessionId} no encontrada`);
    }

    if (session.status === 'closed') {
      return session;
    }

    return this.sessionRepo.close(input.tenantId, input.sessionId, new Date());
  }
}

export class GetTableSessionUseCaseImpl {
  constructor(private readonly sessionRepo: TableSessionRepository) {}

  async execute(input: {
    tenantId: string;
    sessionId: string;
    requester: { role: string; sessionId?: string };
  }): Promise<TableSessionDTO> {
    const session = await this.sessionRepo.findById(input.tenantId, input.sessionId);
    if (!session) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${input.sessionId} no encontrada`);
    }

    if (input.requester.role === 'guest') {
      if (input.requester.sessionId !== session.sessionId) {
        throw new DomainError('FORBIDDEN', 'FORBIDDEN: No autorizado para acceder a esta sesión');
      }
    }

    return session;
  }
}

export class ListTableSessionsUseCaseImpl {
  constructor(private readonly sessionRepo: TableSessionRepository) {}

  async execute(input: {
    tenantId: string;
    filter?: { status?: 'active' | 'closed'; tableId?: string };
  }): Promise<TableSessionDTO[]> {
    return this.sessionRepo.listByTenant(input.tenantId, input.filter);
  }
}
