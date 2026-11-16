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
  TableStatus,
} from '@packages/shared-types';
import { MAX_TABLES_PER_TENANT, normalizeTableLabel } from '../../domain/tableBatch';

type StoredTable = TableDTO & { qrKey: string; labelKey?: string; updatedAt?: string };

function toTableDTO(stored: StoredTable): TableDTO {
  const { qrKey: _qr, labelKey: _lk, updatedAt: _up, ...dto } = stored;
  return dto;
}

export class InMemoryTableRepository implements TableRepository {
  private sessionRepo?: TableSessionRepository;

  public tables: StoredTable[] = [
    {
      tableId: 'tb-1',
      tenantId: 't-1',
      label: 'Mesa 1',
      labelKey: 'mesa 1',
      status: 'active',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
    {
      tableId: 'tb-inactive',
      tenantId: 't-1',
      label: 'Mesa Inactiva',
      labelKey: 'mesa inactiva',
      status: 'inactive',
      qrKey: 'k-1',
      createdAt: new Date().toISOString(),
    },
  ];

  constructor(sessionRepo?: TableSessionRepository) {
    this.sessionRepo = sessionRepo;
  }

  setSessionRepository(repo: TableSessionRepository): void {
    this.sessionRepo = repo;
  }

  private getLabelKey(t: { label: string; labelKey?: string }): string {
    if (t.labelKey) return t.labelKey;
    try {
      return normalizeTableLabel(t.label).labelKey;
    } catch {
      return t.label.trim().toLocaleLowerCase('es');
    }
  }

  async save(tenantId: string, table: TableDTO & { qrKey: string; labelKey?: string }): Promise<TableDTO> {
    const existingIndex = this.tables.findIndex(
      (t) => t.tenantId === tenantId && t.tableId === table.tableId
    );
    const labelKey = this.getLabelKey(table);
    const stored: StoredTable = {
      ...table,
      tenantId,
      labelKey,
      ...(table.status === 'deleted' && table.deletedAt ? { deletedAt: table.deletedAt } : {}),
    };
    if (existingIndex >= 0) {
      this.tables[existingIndex] = stored;
    } else {
      this.tables.push(stored);
    }
    return toTableDTO(stored);
  }

  async findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null> {
    const found = this.tables.find((t) => t.tenantId === tenantId && t.tableId === tableId);
    if (!found) return null;
    const { labelKey: _lk, updatedAt: _up, ...rest } = found;
    return { ...rest };
  }

  async listByTenant(tenantId: string): Promise<TableDTO[]> {
    return this.tables
      .filter((t) => t.tenantId === tenantId && t.status !== 'deleted' && !t.deletedAt)
      .map((stored) => {
        const dto = toTableDTO(stored);
        return {
          ...dto,
          capacity: dto.capacity ?? 4,
          status: dto.status ?? 'AVAILABLE',
        };
      });
  }

  async delete(tenantId: string, tableId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const newQrKey = `qr-${Date.now()}`;
    await this.softDeleteMany(tenantId, [{ tableId, deletedAt: nowIso, newQrKey }]);
  }

  async createMany(
    tenantId: string,
    tables: Array<TableDTO & { qrKey: string; labelKey?: string }>
  ): Promise<TableDTO[]> {
    const liveTables = this.tables.filter(
      (t) => t.tenantId === tenantId && t.status !== 'deleted'
    );

    const existingKeys = new Set<string>(liveTables.map((t) => this.getLabelKey(t)));
    const batchSeenKeys = new Set<string>();
    const conflicts: string[] = [];

    for (const incoming of tables) {
      const key = this.getLabelKey(incoming);
      if (existingKeys.has(key) || batchSeenKeys.has(key)) {
        if (!conflicts.includes(key)) {
          conflicts.push(key);
        }
      }
      batchSeenKeys.add(key);
    }

    if (conflicts.length > 0) {
      throw new DomainError('TABLE_LABEL_TAKEN', 'Table label already exists', {
        conflicts,
      });
    }

    if (liveTables.length + tables.length > MAX_TABLES_PER_TENANT) {
      throw new DomainError(
        'TABLE_LIMIT_EXCEEDED',
        `Maximum of ${MAX_TABLES_PER_TENANT} live tables per tenant exceeded`,
        {
          current: liveTables.length,
          requested: tables.length,
          max: MAX_TABLES_PER_TENANT,
        }
      );
    }

    const created: TableDTO[] = [];
    for (const incoming of tables) {
      const stored: StoredTable = {
        ...incoming,
        tenantId,
        capacity: incoming.capacity ?? 4,
        status: incoming.status ?? 'AVAILABLE',
        labelKey: this.getLabelKey(incoming),
      };
      this.tables.push(stored);
      created.push(toTableDTO(stored));
    }

    return created;
  }

  async updateMany(
    tenantId: string,
    updates: Array<{
      tableId: string;
      label?: string;
      labelKey?: string;
      status?: TableStatus;
      zoneId?: string;
      capacity?: number;
    }>
  ): Promise<TableDTO[]> {
    const missingIds: string[] = [];
    const targetIndices = new Map<string, number>();

    for (const u of updates) {
      const idx = this.tables.findIndex(
        (t) => t.tenantId === tenantId && t.tableId === u.tableId && t.status !== 'deleted'
      );
      if (idx === -1) {
        missingIds.push(u.tableId);
      } else {
        targetIndices.set(u.tableId, idx);
      }
    }

    if (missingIds.length > 0) {
      throw new DomainError('TABLE_NOT_FOUND', `Table ${missingIds[0]} not found`, {
        tableIds: missingIds,
      });
    }

    const updateByTableId = new Map(updates.map((u) => [u.tableId, u]));
    const liveTables = this.tables.filter(
      (t) => t.tenantId === tenantId && t.status !== 'deleted'
    );

    const finalKeys = new Set<string>();
    const conflicts: string[] = [];

    for (const table of liveTables) {
      const pending = updateByTableId.get(table.tableId);
      const finalKey =
        pending && pending.label !== undefined
          ? pending.labelKey ?? normalizeTableLabel(pending.label).labelKey
          : this.getLabelKey(table);

      if (finalKeys.has(finalKey)) {
        if (!conflicts.includes(finalKey)) {
          conflicts.push(finalKey);
        }
      } else {
        finalKeys.add(finalKey);
      }
    }

    if (conflicts.length > 0) {
      throw new DomainError('TABLE_LABEL_TAKEN', 'Table label already exists', {
        conflicts,
      });
    }

    const nowIso = new Date().toISOString();
    const updatedDtos: TableDTO[] = [];

    for (const u of updates) {
      const idx = targetIndices.get(u.tableId)!;
      const current = this.tables[idx];
      const nextLabel = u.label !== undefined ? u.label : current.label;
      const nextLabelKey =
        u.label !== undefined
          ? u.labelKey ?? normalizeTableLabel(u.label).labelKey
          : this.getLabelKey(current);
      const nextStatus = u.status !== undefined ? u.status : current.status;
      const nextZoneId = u.zoneId !== undefined ? u.zoneId : current.zoneId;
      const nextCapacity = u.capacity !== undefined ? u.capacity : current.capacity;

      const updated: StoredTable = {
        ...current,
        label: nextLabel,
        labelKey: nextLabelKey,
        status: nextStatus,
        zoneId: nextZoneId,
        capacity: nextCapacity,
        updatedAt: nowIso,
      };
      this.tables[idx] = updated;
      updatedDtos.push(toTableDTO(updated));
    }

    return updatedDtos;
  }

  async softDeleteMany(
    tenantId: string,
    items: Array<{ tableId: string; deletedAt: string; newQrKey: string }>
  ): Promise<{
    deleted: string[];
    failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' }>;
  }> {
    const deleted: string[] = [];
    const failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' }> = [];

    for (const item of items) {
      const idx = this.tables.findIndex(
        (t) => t.tenantId === tenantId && t.tableId === item.tableId
      );
      if (idx === -1 || this.tables[idx].status === 'deleted') {
        failed.push({ tableId: item.tableId, code: 'TABLE_NOT_FOUND' });
        continue;
      }

      if (this.sessionRepo) {
        const activeSession = await this.sessionRepo.findActiveByTable(tenantId, item.tableId);
        if (activeSession && (activeSession.status === 'active' || activeSession.status === 'billRequested')) {
          failed.push({ tableId: item.tableId, code: 'TABLE_HAS_ACTIVE_SESSION' });
          continue;
        }
      }

      this.tables[idx] = {
        ...this.tables[idx],
        status: 'deleted',
        deletedAt: item.deletedAt,
        qrKey: item.newQrKey,
        updatedAt: item.deletedAt,
      };
      deleted.push(item.tableId);
    }

    return { deleted, failed };
  }

  async rotateQrAtomic(
    tenantId: string,
    tableId: string,
    newQrKey: string
  ): Promise<(TableDTO & { qrKey: string }) | null> {
    const idx = this.tables.findIndex(
      (t) => t.tenantId === tenantId && t.tableId === tableId && t.status !== 'deleted'
    );
    if (idx === -1) return null;
    this.tables[idx].qrKey = newQrKey;
    this.tables[idx].updatedAt = new Date().toISOString();
    return { ...this.tables[idx] };
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
    if (session.status === 'active') {
      const existing = this.sessions.find(
        (s) => s.tenantId === tenantId && s.tableId === session.tableId && s.status === 'active'
      );
      if (existing && existing.sessionId !== session.sessionId) {
        return { ...existing };
      }
    }
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

  async moveToTable(tenantId: string, sessionId: string, targetTableId: string): Promise<TableSessionDTO> {
    const session = this.sessions.find((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (!session) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }
    if (session.status !== 'active' && session.status !== 'billRequested') {
      throw new DomainError('INVALID_SESSION_STATE', 'No se puede cambiar de mesa una sesión que no está activa');
    }
    const occupied = this.sessions.find(
      (s) =>
        s.tenantId === tenantId &&
        s.tableId === targetTableId &&
        s.sessionId !== sessionId &&
        (s.status === 'active' || s.status === 'billRequested')
    );
    if (occupied) {
      throw new DomainError('TABLE_HAS_ACTIVE_SESSION', `La mesa de destino ${targetTableId} ya tiene una sesión activa`);
    }
    session.tableId = targetTableId;
    return { ...session };
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
    if (index !== -1 && this.sessions[index].status === 'active') {
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
  public prepMinutes = new Map<string, number>();

  setOperatingMode(tenantId: string, mode: OperatingMode): void {
    this.modes.set(tenantId, mode);
  }

  async getOperatingMode(tenantId: string): Promise<OperatingMode> {
    return this.modes.get(tenantId) || 'hybrid';
  }

  async getEstimatedPrepMinutes(tenantId: string): Promise<number> {
    return this.prepMinutes.get(tenantId) ?? 18;
  }
}
