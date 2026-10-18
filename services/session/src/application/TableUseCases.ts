import crypto from 'crypto';
import {
  TableDTO,
  TableStatus,
  QrCodeResult,
  TableRepository,
  ZoneRepository,
  QrCodeGenerator,
  DomainError,
} from '@packages/shared-types';

export const VALID_TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'];

export function parseAndValidateTableStatus(status: any): TableStatus | null {
  if (typeof status !== 'string') return null;
  const upper = status.trim().toUpperCase();
  if (VALID_TABLE_STATUSES.includes(upper)) {
    return upper as TableStatus;
  }
  if (upper === 'ACTIVE') return 'AVAILABLE';
  if (upper === 'INACTIVE') return 'DISABLED';
  return null;
}

export class CreateTableUseCaseImpl {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly zoneRepo?: ZoneRepository
  ) {}

  async execute(input: {
    tenantId: string;
    label: string;
    zoneId?: string;
    capacity?: number;
    status?: TableStatus;
  }): Promise<TableDTO> {
    if (!input.label || typeof input.label !== 'string' || input.label.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El nombre de la mesa es requerido');
    }

    if (!input.zoneId || typeof input.zoneId !== 'string' || input.zoneId.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El zoneId es obligatorio');
    }

    if (this.zoneRepo) {
      const zone = await this.zoneRepo.findById(input.tenantId, input.zoneId.trim());
      if (!zone) {
        throw new DomainError('VALIDATION_ERROR', `Zona ${input.zoneId} no encontrada`);
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

    const tableId = `table-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const qrKey = crypto.randomBytes(8).toString('hex');

    const table = {
      tableId,
      tenantId: input.tenantId,
      label: input.label.trim(),
      status: normalizedStatus,
      zoneId: input.zoneId.trim(),
      capacity: input.capacity ?? 4,
      createdAt: new Date().toISOString(),
    };

    return this.tableRepo.save(input.tenantId, { ...table, qrKey });
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
    if (!table) {
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
    if (!table) {
      throw new DomainError('TABLE_NOT_FOUND', `Mesa ${input.tableId} no encontrada`);
    }

    const newKey = `rotated-${crypto.randomBytes(8).toString('hex')}`;
    await this.tableRepo.save(input.tenantId, {
      ...table,
      qrKey: newKey,
    });

    const payloadUrl = `${this.baseUrl}/t/${input.tenantId}/${input.tableId}?k=${newKey}`;
    return this.qrGenerator.generate(payloadUrl);
  }
}
