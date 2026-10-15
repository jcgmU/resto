import {
  TableRepository,
  TableSessionRepository,
  ZoneRepository,
  ReservationRepository,
  QrCodeGenerator,
  TableDTO,
  ZoneDTO,
  ReservationDTO,
  ReservationStatus,
  TableSessionDTO,
  QrCodeResult,
  DomainError,
  IdentitySettingsPort,
  OperatingMode,
} from '@packages/shared-types';

export class InMemoryTableRepository implements TableRepository {
  public tables: (TableDTO & { qrKey: string })[] = [
    {
      tableId: 'tb-1',
      tenantId: 't-1',
      label: 'Mesa 1',
      status: 'active',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
    {
      tableId: 'tb-inactive',
      tenantId: 't-1',
      label: 'Mesa Inactiva',
      status: 'inactive',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
  ];

  async save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO> {
    const existingIndex = this.tables.findIndex(
      (t) => t.tenantId === tenantId && t.tableId === table.tableId
    );
    if (existingIndex >= 0) {
      this.tables[existingIndex] = { ...table, tenantId };
    } else {
      this.tables.push({ ...table, tenantId });
    }
    const { qrKey: _, ...dto } = table;
    return dto;
  }

  async findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null> {
    const found = this.tables.find((t) => t.tenantId === tenantId && t.tableId === tableId);
    return found ? { ...found } : null;
  }

  async listByTenant(tenantId: string): Promise<TableDTO[]> {
    return this.tables
      .filter((t) => t.tenantId === tenantId)
      .map(({ qrKey: _, ...dto }) => ({
        ...dto,
        capacity: dto.capacity ?? 4,
        status: dto.status ?? 'AVAILABLE',
      }));
  }

  async delete(tenantId: string, tableId: string): Promise<void> {
    this.tables = this.tables.filter((t) => !(t.tenantId === tenantId && t.tableId === tableId));
  }
}

export class InMemoryTableSessionRepository implements TableSessionRepository {
  public sessions: TableSessionDTO[] = [];

  async findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null> {
    const found = this.sessions.find(
      (s) => s.tenantId === tenantId && s.tableId === tableId && (s.status === 'active' || s.status === 'billRequested')
    );
    return found ? { ...found } : null;
  }

  async findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const found = this.sessions.find((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    return found ? { ...found } : null;
  }

  async save(tenantId: string, session: TableSessionDTO, _ttlSeconds: number): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === session.sessionId);
    if (index >= 0) {
      this.sessions[index] = { ...session, tenantId };
    } else {
      this.sessions.push({ ...session, tenantId });
    }
    return session;
  }

  async requestBill(tenantId: string, sessionId: string): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index === -1) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }
    if (this.sessions[index].status !== 'active') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede solicitar la cuenta para una sesión en estado '${this.sessions[index].status}'`
      );
    }
    this.sessions[index].status = 'billRequested';
    this.sessions[index].billRequestedAt = new Date().toISOString();
    return { ...this.sessions[index] };
  }

  async reopenBill(tenantId: string, sessionId: string): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index === -1) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }
    if (this.sessions[index].status !== 'billRequested') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede reabrir la cuenta para una sesión en estado '${this.sessions[index].status}'`
      );
    }
    this.sessions[index].status = 'active';
    delete this.sessions[index].billRequestedAt;
    return { ...this.sessions[index] };
  }

  async close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index === -1) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }
    if (this.sessions[index].status === 'closed') {
      return { ...this.sessions[index] };
    }
    this.sessions[index].status = 'closed';
    this.sessions[index].closedAt = closedAt.toISOString();
    return { ...this.sessions[index] };
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string }
  ): Promise<TableSessionDTO[]> {
    return this.sessions.filter((s) => {
      if (s.tenantId !== tenantId) return false;
      if (filter?.status && s.status !== filter.status) return false;
      if (filter?.tableId && s.tableId !== filter.tableId) return false;
      return true;
    });
  }

  async touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index !== -1) {
      this.sessions[index].expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    }
  }

  async getOrCreateActive(
    tenantId: string,
    tableId: string,
    candidateOrTtl: TableSessionDTO | number,
    maybeTtl?: number
  ): Promise<TableSessionDTO> {
    let candidate: TableSessionDTO;
    let ttlSeconds: number;
    if (typeof candidateOrTtl === 'number') {
      ttlSeconds = candidateOrTtl;
      const now = new Date();
      candidate = {
        sessionId: `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId,
        tableId,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      };
    } else {
      candidate = candidateOrTtl;
      ttlSeconds = maybeTtl ?? 14400;
    }

    const existing = await this.findActiveByTable(tenantId, tableId);
    if (existing) {
      await this.touch(tenantId, existing.sessionId, ttlSeconds);
      return existing;
    }

    return this.save(tenantId, candidate, ttlSeconds);
  }
}

export class FakeQrCodeGenerator implements QrCodeGenerator {
  async generate(payloadUrl: string): Promise<QrCodeResult> {
    return {
      url: payloadUrl,
      pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    };
  }
}

export class InMemoryZoneRepository implements ZoneRepository {
  public zones: ZoneDTO[] = [];

  async save(tenantId: string, zone: ZoneDTO): Promise<ZoneDTO> {
    const index = this.zones.findIndex((z) => z.tenantId === tenantId && z.id === zone.id);
    if (index >= 0) {
      this.zones[index] = { ...zone, tenantId };
    } else {
      this.zones.push({ ...zone, tenantId });
    }
    return zone;
  }

  async findById(tenantId: string, zoneId: string): Promise<ZoneDTO | null> {
    const found = this.zones.find((z) => z.tenantId === tenantId && z.id === zoneId);
    return found ? { ...found } : null;
  }

  async listByTenant(tenantId: string): Promise<ZoneDTO[]> {
    return this.zones
      .filter((z) => z.tenantId === tenantId)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
  }

  async delete(tenantId: string, zoneId: string): Promise<void> {
    this.zones = this.zones.filter((z) => !(z.tenantId === tenantId && z.id === zoneId));
  }
}

export class InMemoryReservationRepository implements ReservationRepository {
  public reservations: ReservationDTO[] = [];

  async save(tenantId: string, reservation: ReservationDTO): Promise<ReservationDTO> {
    const index = this.reservations.findIndex((r) => r.tenantId === tenantId && r.id === reservation.id);
    if (index >= 0) {
      this.reservations[index] = { ...reservation, tenantId };
    } else {
      this.reservations.push({ ...reservation, tenantId });
    }
    return reservation;
  }

  async findById(tenantId: string, reservationId: string): Promise<ReservationDTO | null> {
    const found = this.reservations.find((r) => r.tenantId === tenantId && r.id === reservationId);
    return found ? { ...found } : null;
  }

  async listByTenant(
    tenantId: string,
    filter?: { tableId?: string; date?: string; status?: ReservationStatus }
  ): Promise<ReservationDTO[]> {
    return this.reservations
      .filter((r) => {
        if (r.tenantId !== tenantId) return false;
        if (filter?.tableId && r.tableId !== filter.tableId) return false;
        if (filter?.status && r.status !== filter.status) return false;
        if (filter?.date && !r.reservedFor.startsWith(filter.date)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.reservedFor).getTime() - new Date(b.reservedFor).getTime());
  }

  async listByTable(tenantId: string, tableId: string): Promise<ReservationDTO[]> {
    return this.listByTenant(tenantId, { tableId });
  }

  async delete(tenantId: string, reservationId: string): Promise<void> {
    this.reservations = this.reservations.filter((r) => !(r.tenantId === tenantId && r.id === reservationId));
  }
}

export class InMemoryIdentitySettingsAdapter implements IdentitySettingsPort {
  public modes = new Map<string, OperatingMode>();

  setOperatingMode(tenantId: string, mode: OperatingMode): void {
    this.modes.set(tenantId, mode);
  }

  async getOperatingMode(tenantId: string): Promise<OperatingMode> {
    return this.modes.get(tenantId) || 'hybrid';
  }
}


