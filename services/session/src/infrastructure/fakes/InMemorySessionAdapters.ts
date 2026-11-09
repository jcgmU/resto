import {
  TableRepository,
  TableSessionRepository,
  QrCodeGenerator,
  TableDTO,
  TableSessionDTO,
  QrCodeResult,
  DomainError,
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
      .filter((t) => t.tenantId === tenantId && t.status !== 'deleted')
      .map(toTableDTO);
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
        labelKey: this.getLabelKey(incoming),
      };
      this.tables.push(stored);
      created.push(toTableDTO(stored));
    }

    return created;
  }

  async updateMany(
    tenantId: string,
    updates: Array<{ tableId: string; label?: string; labelKey?: string; status?: 'active' | 'inactive' }>
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

      const updated: StoredTable = {
        ...current,
        label: nextLabel,
        labelKey: nextLabelKey,
        status: nextStatus,
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
        if (activeSession) {
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
}

export class InMemoryTableSessionRepository implements TableSessionRepository {
  public sessions: TableSessionDTO[] = [];

  async findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null> {
    const found = this.sessions.find(
      (s) => s.tenantId === tenantId && s.tableId === tableId && s.status === 'active'
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

  async close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO> {
    const index = this.sessions.findIndex((s) => s.tenantId === tenantId && s.sessionId === sessionId);
    if (index === -1) {
      throw new Error('SESSION_NOT_FOUND');
    }
    this.sessions[index].status = 'closed';
    this.sessions[index].closedAt = closedAt.toISOString();
    return { ...this.sessions[index] };
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'closed'; tableId?: string }
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
}

export class FakeQrCodeGenerator implements QrCodeGenerator {
  async generate(payloadUrl: string): Promise<QrCodeResult> {
    return {
      url: payloadUrl,
      pngDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    };
  }
}
