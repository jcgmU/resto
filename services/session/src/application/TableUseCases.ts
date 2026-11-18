import crypto from 'crypto';
import {
  TableDTO,
  TableStatus,
  QrCodeResult,
  TableRepository,
  TableSessionRepository,
  ZoneRepository,
  ReservationRepository,
  QrCodeGenerator,
  DomainError,
} from '@packages/shared-types';
import {
  normalizeTableLabel,
  parseCreateBatchInput,
  parseUpdateBatchInput,
  parseDeleteBatchInput,
  VALID_TABLE_STATUSES,
  parseAndValidateTableStatus,
} from '../domain/tableBatch';
import { SessionEventPublisherPort } from '../domain/events';
import { isReservationActive } from '../domain/reservationRules';

export { VALID_TABLE_STATUSES, parseAndValidateTableStatus };

export class CreateTableUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly zoneRepo?: ZoneRepository,
    private readonly eventPublisher?: SessionEventPublisherPort
  ) {}

  async execute(input: {
    tenantId: string;
    label: unknown;
    zoneId?: string;
    capacity?: number;
    status?: TableStatus;
  }): Promise<TableDTO> {
    const { label, labelKey } = normalizeTableLabel(input.label);

    if (!input.zoneId || typeof input.zoneId !== 'string' || input.zoneId.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El zoneId es obligatorio');
    }

    if (this.zoneRepo) {
      const zone = await this.zoneRepo.findById(input.tenantId, input.zoneId.trim());
      if (!zone || zone.tenantId !== input.tenantId) {
        throw new DomainError('ZONE_NOT_FOUND', `Zona ${input.zoneId} no encontrada`);
      }
    }

    if (input.capacity !== undefined) {
      if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
        throw new DomainError('VALIDATION_ERROR', 'La capacidad debe ser un entero positivo');
      }
    }

    let normalizedStatus: TableStatus = 'AVAILABLE';
    if (input.status !== undefined) {
      const parsed = parseAndValidateTableStatus(input.status);
      if (!parsed) {
        throw new DomainError('VALIDATION_ERROR', 'Estado de mesa inválido');
      }
      normalizedStatus = parsed;
    }

    const tableId = `table-${crypto.randomUUID()}`;
    const qrKey = crypto.randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();

    const created = await this.tableRepo.createMany(input.tenantId, [
      {
        tableId,
        tenantId: input.tenantId,
        label,
        labelKey,
        status: normalizedStatus,
        zoneId: input.zoneId.trim(),
        capacity: input.capacity ?? 4,
        qrKey,
        createdAt,
      },
    ]);

    if (this.eventPublisher) {
      await this.eventPublisher.publishSessionEvent(input.tenantId, {
        event: 'table:status-changed',
        tenantId: input.tenantId,
        tableId: created[0].tableId,
        sessionId: '',
        status: created[0].status,
        action: 'session_closed',
        timestamp: createdAt,
      } as any);
    }

    return created[0];
  }
}

export class CreateTablesBatchUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly zoneRepo?: ZoneRepository,
    private readonly eventPublisher?: SessionEventPublisherPort
  ) {}

  async execute(input: { tenantId: string; body: unknown }): Promise<{ tables: TableDTO[] }> {
    const { items, zoneId, capacity } = parseCreateBatchInput(input.body);
    const createdAt = new Date().toISOString();

    if (!zoneId || typeof zoneId !== 'string' || zoneId.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El zoneId es obligatorio');
    }

    if (this.zoneRepo) {
      const zone = await this.zoneRepo.findById(input.tenantId, zoneId.trim());
      if (!zone || zone.tenantId !== input.tenantId) {
        throw new DomainError('ZONE_NOT_FOUND', `Zona ${zoneId} no encontrada`);
      }
    }

    const tablesToCreate = items.map(({ label, labelKey }) => ({
      tableId: `table-${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      label,
      labelKey,
      status: 'AVAILABLE' as const,
      zoneId: zoneId.trim(),
      capacity: capacity ?? 4,
      qrKey: crypto.randomBytes(16).toString('hex'),
      createdAt,
    }));

    const tables = await this.tableRepo.createMany(input.tenantId, tablesToCreate);

    if (this.eventPublisher) {
      for (const t of tables) {
        await this.eventPublisher.publishSessionEvent(input.tenantId, {
          event: 'table:status-changed',
          tenantId: input.tenantId,
          tableId: t.tableId,
          sessionId: '',
          status: t.status,
          action: 'session_closed',
          timestamp: createdAt,
        } as any);
      }
    }

    return { tables };
  }
}

export class UpdateTablesBatchUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly zoneRepo?: ZoneRepository,
    private readonly eventPublisher?: SessionEventPublisherPort
  ) {}

  async execute(input: { tenantId: string; body: unknown }): Promise<{ tables: TableDTO[] }> {
    const { updates } = parseUpdateBatchInput(input.body);

    if (this.zoneRepo) {
      for (const u of updates) {
        if (u.zoneId && u.zoneId !== '') {
          const zone = await this.zoneRepo.findById(input.tenantId, u.zoneId);
          if (!zone || zone.tenantId !== input.tenantId) {
            throw new DomainError('ZONE_NOT_FOUND', `Zona ${u.zoneId} no encontrada`);
          }
        }
      }
    }

    const tables = await this.tableRepo.updateMany(input.tenantId, updates);

    if (this.eventPublisher) {
      for (const t of tables) {
        await this.eventPublisher.publishSessionEvent(input.tenantId, {
          event: 'table:status-changed',
          tenantId: input.tenantId,
          tableId: t.tableId,
          sessionId: '',
          status: t.status,
          action: 'session_closed',
          timestamp: new Date().toISOString(),
        } as any);
      }
    }

    return { tables };
  }
}

export class UpdateSingleTableUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly zoneRepo?: ZoneRepository,
    private readonly eventPublisher?: SessionEventPublisherPort
  ) {}

  async execute(input: {
    tenantId: string;
    tableId: string;
    body: unknown;
  }): Promise<TableDTO> {
    const rawBody =
      typeof input.body === 'object' && input.body !== null && !Array.isArray(input.body)
        ? (input.body as Record<string, unknown>)
        : {};
    const { updates } = parseUpdateBatchInput({
      updates: [{ ...rawBody, tableId: input.tableId }],
    });

    if (this.zoneRepo && updates[0].zoneId && updates[0].zoneId !== '') {
      const zone = await this.zoneRepo.findById(input.tenantId, updates[0].zoneId);
      if (!zone || zone.tenantId !== input.tenantId) {
        throw new DomainError('ZONE_NOT_FOUND', `Zona ${updates[0].zoneId} no encontrada`);
      }
    }

    const tables = await this.tableRepo.updateMany(input.tenantId, updates);

    if (this.eventPublisher) {
      await this.eventPublisher.publishSessionEvent(input.tenantId, {
        event: 'table:status-changed',
        tenantId: input.tenantId,
        tableId: tables[0].tableId,
        sessionId: '',
        status: tables[0].status,
        action: 'session_closed',
        timestamp: new Date().toISOString(),
      } as any);
    }

    return tables[0];
  }
}

export class DeleteTablesBatchUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly reservationRepo?: ReservationRepository,
    private readonly sessionRepo?: TableSessionRepository,
    private readonly eventPublisher?: SessionEventPublisherPort
  ) {}

  async execute(input: {
    tenantId: string;
    body: unknown;
  }): Promise<{
    deleted: string[];
    failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' | 'TABLE_HAS_RESERVATIONS' }>;
  }> {
    const { tableIds } = parseDeleteBatchInput(input.body);
    const nowIso = new Date().toISOString();

    const failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' | 'TABLE_HAS_RESERVATIONS' }> = [];
    const eligibleTableIds: string[] = [];

    for (const tableId of tableIds) {
      if (this.reservationRepo) {
        const reservations = await this.reservationRepo.listByTable(input.tenantId, tableId);
        const hasActiveReservations = reservations.some((r) => isReservationActive(r, Date.now()));

        if (hasActiveReservations) {
          failed.push({ tableId, code: 'TABLE_HAS_RESERVATIONS' });
          continue;
        }
      }
      eligibleTableIds.push(tableId);
    }

    const items = eligibleTableIds.map((tableId) => ({
      tableId,
      deletedAt: nowIso,
      newQrKey: crypto.randomBytes(16).toString('hex'),
    }));

    const result = items.length > 0
      ? await this.tableRepo.softDeleteMany(input.tenantId, items)
      : { deleted: [], failed: [] };

    const allFailed = [...failed, ...result.failed];

    if (result.deleted.length === 0) {
      throw new DomainError(
        'TABLES_NOT_DELETABLE',
        'None of the requested tables could be deleted',
        {
          deleted: result.deleted,
          failed: allFailed,
        }
      );
    }

    if (this.eventPublisher) {
      for (const tableId of result.deleted) {
        await this.eventPublisher.publishSessionEvent(input.tenantId, {
          event: 'table:status-changed',
          tenantId: input.tenantId,
          tableId,
          sessionId: '',
          status: 'AVAILABLE',
          action: 'session_closed',
          timestamp: nowIso,
        } as any);
      }
    }

    return {
      deleted: result.deleted,
      failed: allFailed,
    };
  }
}

export class GenerateTableQrUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly qrGenerator: QrCodeGenerator,
    private readonly baseUrl: string = 'http://localhost:3000'
  ) {}

  async execute(input: { tenantId: string; tableId: string }): Promise<QrCodeResult> {
    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table || table.status === 'deleted') {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${table.qrKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}

export class RotateTableQrKeyUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly qrGenerator: QrCodeGenerator,
    private readonly baseUrl: string = 'http://localhost:3000'
  ) {}

  async execute(input: { tenantId: string; tableId: string }): Promise<QrCodeResult> {
    const table = await this.tableRepo.findById(input.tenantId, input.tableId);
    if (!table || table.status === 'deleted') {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    const newKey = crypto.randomBytes(16).toString('hex');
    if (typeof this.tableRepo.rotateQrAtomic === 'function') {
      await this.tableRepo.rotateQrAtomic(input.tenantId, input.tableId, newKey);
    } else {
      await this.tableRepo.save(input.tenantId, {
        ...table,
        qrKey: newKey,
      });
    }

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${newKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}
