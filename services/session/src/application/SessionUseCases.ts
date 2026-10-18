import {
  OpenSessionRequest,
  OpenSessionResult,
  TableSessionDTO,
  TableSessionRepository,
  TableRepository,
  ReservationRepository,
  GuestTokenIssuer,
  IdentitySettingsPort,
  DomainError,
} from '@packages/shared-types';

export class OpenTableSessionUseCaseImpl {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly tableRepo: TableRepository,
    private readonly tokenIssuer: GuestTokenIssuer,
    private readonly ttlSeconds: number = 14400,
    private readonly reservationRepo?: ReservationRepository,
    private readonly identitySettings?: IdentitySettingsPort
  ) {}

  async execute(input: OpenSessionRequest): Promise<OpenSessionResult> {
    if (this.identitySettings) {
      const mode = await this.identitySettings.getOperatingMode(input.tenantId);
      if (mode === 'waiter_only') {
        throw new DomainError('QR_DISABLED', 'El pedido por código QR está desactivado en este restaurante');
      }
    }

    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `TABLE_NOT_FOUND: Mesa ${input.tableId} no encontrada`);
    }

    if (table.status === 'DISABLED' || table.status === 'inactive') {
      throw new DomainError('TABLE_INACTIVE', `TABLE_INACTIVE: Mesa ${input.tableId} inactiva`);
    }

    if (table.qrKey !== input.qrKey) {
      throw new DomainError('QR_KEY_INVALID', 'QR_KEY_INVALID: Código QR inválido');
    }

    if (this.reservationRepo) {
      const reservations = await this.reservationRepo.listByTable(input.tenantId, input.tableId);
      const now = Date.now();
      const windowStart = now - 30 * 60 * 1000;
      const windowEnd = now + 2 * 60 * 60 * 1000;

      const blockingReservation = reservations.find((r) => {
        if (r.status !== 'active') return false;
        const resTime = new Date(r.reservedFor).getTime();
        return resTime >= windowStart && resTime <= windowEnd;
      });

      if (blockingReservation) {
        throw new DomainError(
          'TABLE_RESERVED',
          `La mesa ${input.tableId} tiene una reserva activa para ${blockingReservation.reservedFor}`
        );
      }
    }

    const now = new Date();
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const candidateSession: TableSessionDTO = {
      sessionId,
      tenantId: input.tenantId,
      tableId: input.tableId,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlSeconds * 1000).toISOString(),
    };

    let session: TableSessionDTO;
    if (typeof this.sessionRepo.getOrCreateActive === 'function') {
      session = await this.sessionRepo.getOrCreateActive(
        input.tenantId,
        input.tableId,
        candidateSession,
        this.ttlSeconds
      );
    } else {
      const existing = await this.sessionRepo.findActiveByTable(input.tenantId, input.tableId);
      if (existing) {
        await this.sessionRepo.touch(input.tenantId, existing.sessionId, this.ttlSeconds);
        session = existing;
      } else {
        session = await this.sessionRepo.save(input.tenantId, candidateSession, this.ttlSeconds);
      }
    }

    const guestToken = this.tokenIssuer.issue(
      { tenantId: input.tenantId, sessionId: session.sessionId, role: 'guest' },
      this.ttlSeconds
    );

    return { session, guestToken };
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

export class RequestBillSessionUseCaseImpl {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly orderingServiceCall?: import('../domain/orderingPorts').OrderingServiceCallPort
  ) {}

  async execute(input: { tenantId: string; sessionId: string }): Promise<TableSessionDTO> {
    const session = await this.sessionRepo.findById(input.tenantId, input.sessionId);
    if (!session) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${input.sessionId} no encontrada`);
    }

    if (session.status === 'billRequested') {
      return session;
    }

    if (session.status !== 'active') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede solicitar la cuenta para una sesión en estado '${session.status}'`
      );
    }

    const updatedSession = await this.sessionRepo.requestBill(input.tenantId, input.sessionId);

    if (this.orderingServiceCall) {
      try {
        await this.orderingServiceCall.createServiceCall({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          tableId: session.tableId,
          type: 'BILL_REQUEST',
        });
      } catch (err: any) {
        console.warn(`[RequestBillSessionUseCase] Error al crear ServiceCall BILL_REQUEST en ordering: ${err?.message || err}`);
      }
    }

    return updatedSession;
  }
}

export class ReopenBillSessionUseCaseImpl {
  constructor(private readonly sessionRepo: TableSessionRepository) {}

  async execute(input: { tenantId: string; sessionId: string }): Promise<TableSessionDTO> {
    const session = await this.sessionRepo.findById(input.tenantId, input.sessionId);
    if (!session) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${input.sessionId} no encontrada`);
    }

    if (session.status !== 'billRequested') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede reabrir la cuenta para una sesión en estado '${session.status}'`
      );
    }

    return this.sessionRepo.reopenBill(input.tenantId, input.sessionId);
  }
}

export class ListTableSessionsUseCaseImpl {
  constructor(private readonly sessionRepo: TableSessionRepository) {}

  async execute(input: {
    tenantId: string;
    filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string };
  }): Promise<TableSessionDTO[]> {
    return this.sessionRepo.listByTenant(input.tenantId, input.filter);
  }
}

export class StaffOpenSessionUseCaseImpl {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly tableRepo: TableRepository,
    private readonly ttlSeconds: number = 14400
  ) {}

  async execute(input: { tenantId: string; tableId: string }): Promise<{ session: TableSessionDTO }> {
    if (!input.tenantId || !input.tableId) {
      throw new DomainError('VALIDATION_ERROR', 'tenantId y tableId son requeridos');
    }

    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `TABLE_NOT_FOUND: Mesa ${input.tableId} no encontrada`);
    }

    if (table.status === 'DISABLED' || table.status === 'inactive') {
      throw new DomainError('TABLE_INACTIVE', `TABLE_INACTIVE: Mesa ${input.tableId} inactiva`);
    }

    const now = new Date();
    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const candidateSession: TableSessionDTO = {
      sessionId,
      tenantId: input.tenantId,
      tableId: input.tableId,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlSeconds * 1000).toISOString(),
    };

    let session: TableSessionDTO;
    if (typeof this.sessionRepo.getOrCreateActive === 'function') {
      session = await this.sessionRepo.getOrCreateActive(
        input.tenantId,
        input.tableId,
        candidateSession,
        this.ttlSeconds
      );
    } else {
      const existing = await this.sessionRepo.findActiveByTable(input.tenantId, input.tableId);
      if (existing) {
        await this.sessionRepo.touch(input.tenantId, existing.sessionId, this.ttlSeconds);
        session = existing;
      } else {
        session = await this.sessionRepo.save(input.tenantId, candidateSession, this.ttlSeconds);
      }
    }

    return { session };
  }
}

