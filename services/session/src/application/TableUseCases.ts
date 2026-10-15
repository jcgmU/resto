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

    if (input.zoneId) {
      if (this.zoneRepo) {
        const zone = await this.zoneRepo.findById(input.tenantId, input.zoneId);
        if (!zone) {
          throw new DomainError('ZONE_NOT_FOUND', `Zona ${input.zoneId} no encontrada`);
        }
      }
    }

    if (input.capacity !== undefined) {
      if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
        throw new DomainError('VALIDATION_ERROR', 'La capacidad debe ser un entero positivo');
      }
    }

    const VALID_STATUSES: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED', 'active'];
    if (input.status && !VALID_STATUSES.includes(input.status)) {
      throw new DomainError('VALIDATION_ERROR', 'Estado de mesa inválido');
    }

    const tableId = `table-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const qrKey = crypto.randomBytes(8).toString('hex');

    const table = {
      tableId,
      tenantId: input.tenantId,
      label: input.label.trim(),
      status: input.status || ('AVAILABLE' as const),
      zoneId: input.zoneId,
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
