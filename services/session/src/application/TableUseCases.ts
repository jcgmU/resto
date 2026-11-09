import crypto from 'crypto';
import {
  TableDTO,
  QrCodeResult,
  TableRepository,
  QrCodeGenerator,
  DomainError,
} from '@packages/shared-types';
import {
  normalizeTableLabel,
  parseCreateBatchInput,
  parseUpdateBatchInput,
  parseDeleteBatchInput,
} from '../domain/tableBatch';

export class CreateTableUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

  async execute(input: { tenantId: string; label: unknown }): Promise<TableDTO> {
    const { label, labelKey } = normalizeTableLabel(input.label);
    const tableId = `table-${crypto.randomUUID()}`;
    const qrKey = crypto.randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();

    const created = await this.tableRepo.createMany(input.tenantId, [
      {
        tableId,
        tenantId: input.tenantId,
        label,
        labelKey,
        status: 'active',
        qrKey,
        createdAt,
      },
    ]);

    return created[0];
  }
}

export class CreateTablesBatchUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

  async execute(input: { tenantId: string; body: unknown }): Promise<{ tables: TableDTO[] }> {
    const { items } = parseCreateBatchInput(input.body);
    const createdAt = new Date().toISOString();

    const tablesToCreate = items.map(({ label, labelKey }) => ({
      tableId: `table-${crypto.randomUUID()}`,
      tenantId: input.tenantId,
      label,
      labelKey,
      status: 'active' as const,
      qrKey: crypto.randomBytes(16).toString('hex'),
      createdAt,
    }));

    const tables = await this.tableRepo.createMany(input.tenantId, tablesToCreate);
    return { tables };
  }
}

export class UpdateTablesBatchUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

  async execute(input: { tenantId: string; body: unknown }): Promise<{ tables: TableDTO[] }> {
    const { updates } = parseUpdateBatchInput(input.body);
    const tables = await this.tableRepo.updateMany(input.tenantId, updates);
    return { tables };
  }
}

export class UpdateSingleTableUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

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
    const tables = await this.tableRepo.updateMany(input.tenantId, updates);
    return tables[0];
  }
}

export class DeleteTablesBatchUseCaseImpl {
  constructor(private readonly tableRepo: TableRepository) {}

  async execute(input: {
    tenantId: string;
    body: unknown;
  }): Promise<{
    deleted: string[];
    failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' }>;
  }> {
    const { tableIds } = parseDeleteBatchInput(input.body);
    const nowIso = new Date().toISOString();

    const items = tableIds.map((tableId) => ({
      tableId,
      deletedAt: nowIso,
      newQrKey: crypto.randomBytes(16).toString('hex'),
    }));

    const result = await this.tableRepo.softDeleteMany(input.tenantId, items);

    if (result.deleted.length === 0) {
      throw new DomainError(
        'TABLES_NOT_DELETABLE',
        'None of the requested tables could be deleted',
        {
          deleted: result.deleted,
          failed: result.failed,
        }
      );
    }

    return {
      deleted: result.deleted,
      failed: result.failed,
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
    await this.tableRepo.save(input.tenantId, {
      ...table,
      qrKey: newKey,
    });

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${newKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}
