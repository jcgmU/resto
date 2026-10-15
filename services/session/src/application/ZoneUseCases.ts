import { ZoneDTO, ZoneRepository, TableRepository, DomainError } from '@packages/shared-types';

export class CreateZoneUseCaseImpl {
  constructor(private readonly zoneRepo: ZoneRepository) {}

  async execute(input: { tenantId: string; name: string; sortOrder?: number; id?: string }): Promise<ZoneDTO> {
    if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'El nombre de la zona es requerido');
    }

    const sortOrder = typeof input.sortOrder === 'number' ? input.sortOrder : 0;
    const id = input.id || `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const zone: ZoneDTO = {
      id,
      tenantId: input.tenantId,
      name: input.name.trim(),
      sortOrder,
    };

    return this.zoneRepo.save(input.tenantId, zone);
  }
}

export class UpdateZoneUseCaseImpl {
  constructor(private readonly zoneRepo: ZoneRepository) {}

  async execute(input: { tenantId: string; zoneId: string; name?: string; sortOrder?: number }): Promise<ZoneDTO> {
    const zone = await this.zoneRepo.findById(input.tenantId, input.zoneId);
    if (!zone) {
      throw new DomainError('ZONE_NOT_FOUND', `Zona ${input.zoneId} no encontrada`);
    }

    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim() === '') {
        throw new DomainError('VALIDATION_ERROR', 'El nombre de la zona no puede estar vacío');
      }
      zone.name = input.name.trim();
    }

    if (input.sortOrder !== undefined) {
      if (typeof input.sortOrder !== 'number') {
        throw new DomainError('VALIDATION_ERROR', 'sortOrder debe ser un número');
      }
      zone.sortOrder = input.sortOrder;
    }

    return this.zoneRepo.save(input.tenantId, zone);
  }
}

export class ListZonesUseCaseImpl {
  constructor(private readonly zoneRepo: ZoneRepository) {}

  async execute(input: { tenantId: string }): Promise<ZoneDTO[]> {
    return this.zoneRepo.listByTenant(input.tenantId);
  }
}

export class DeleteZoneUseCaseImpl {
  constructor(
    private readonly zoneRepo: ZoneRepository,
    private readonly tableRepo: TableRepository
  ) {}

  async execute(input: { tenantId: string; zoneId: string }): Promise<void> {
    const zone = await this.zoneRepo.findById(input.tenantId, input.zoneId);
    if (!zone) {
      throw new DomainError('ZONE_NOT_FOUND', `Zona ${input.zoneId} no encontrada`);
    }

    const tables = await this.tableRepo.listByTenant(input.tenantId);
    const hasTables = tables.some((t) => t.zoneId === input.zoneId);
    if (hasTables) {
      throw new DomainError(
        'ZONE_HAS_TABLES',
        'No se puede eliminar la zona porque tiene mesas asignadas'
      );
    }

    await this.zoneRepo.delete(input.tenantId, input.zoneId);
  }
}
