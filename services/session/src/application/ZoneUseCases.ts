import { ZoneDTO, ZoneRepository, TableRepository, DomainError, floorplan, zoneToFloorSpace } from '@packages/shared-types';

export class ZonePolygonError extends Error {
  constructor(readonly details: floorplan.SpaceRuleError) {
    super(details.code);
  }
}

async function checkedPolygon(zoneRepo: ZoneRepository, zone: ZoneDTO, candidate: unknown): Promise<floorplan.Polygon> {
  const invalid = floorplan.validateSpacePolygon(candidate, zone.id);
  if (invalid) throw new ZonePolygonError(invalid);
  const step = floorplan.DEFAULT_FLOOR_LIMITS.gridStepM;
  const snap = (value: number) => Number((Math.round(value / step) * step).toFixed(6));
  const polygon: floorplan.Polygon = (candidate as floorplan.Polygon).map(([x, y]) => [snap(x), snap(y)]);
  const spaces = (await zoneRepo.listByTenant(zone.tenantId))
    .map(zoneToFloorSpace)
    .filter((space): space is floorplan.FloorSpace => space !== null);
  const error = floorplan.checkSpace({ id: zone.id, name: zone.name, polygon }, spaces, floorplan.DEFAULT_FLOOR_LIMITS, zone.id);
  if (error) throw new ZonePolygonError(error);
  return polygon;
}

export class CreateZoneUseCaseImpl {
  constructor(private readonly zoneRepo: ZoneRepository) {}

  async execute(input: { tenantId: string; name: string; sortOrder?: number; id?: string; staffIds?: string[]; polygon?: floorplan.Polygon | null }): Promise<ZoneDTO> {
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
      staffIds: Array.isArray(input.staffIds) ? input.staffIds : [],
    };

    if (input.polygon !== undefined && input.polygon !== null) {
      zone.polygon = await checkedPolygon(this.zoneRepo, zone, input.polygon);
    }
    return this.zoneRepo.save(input.tenantId, zone);
  }
}

export class UpdateZoneUseCaseImpl {
  constructor(private readonly zoneRepo: ZoneRepository) {}

  async execute(input: { tenantId: string; zoneId: string; name?: string; sortOrder?: number; staffIds?: string[]; polygon?: floorplan.Polygon | null }): Promise<ZoneDTO> {
    const existing = await this.zoneRepo.findById(input.tenantId, input.zoneId);
    if (!existing) {
      throw new DomainError('ZONE_NOT_FOUND', `Zona ${input.zoneId} no encontrada`);
    }
    const zone = { ...existing };

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

    if (input.staffIds !== undefined) {
      if (!Array.isArray(input.staffIds)) {
        throw new DomainError('VALIDATION_ERROR', 'staffIds debe ser una lista');
      }
      zone.staffIds = input.staffIds;
    }

    if (input.polygon === null) delete zone.polygon;
    else if (input.polygon !== undefined) zone.polygon = await checkedPolygon(this.zoneRepo, zone, input.polygon);
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
    const hasTables = tables.some(
      (t) => t.zoneId === input.zoneId && t.status !== 'deleted' && !t.deletedAt
    );
    if (hasTables) {
      throw new DomainError(
        'ZONE_HAS_TABLES',
        'No se puede eliminar la zona porque tiene mesas asignadas'
      );
    }

    await this.zoneRepo.delete(input.tenantId, input.zoneId);
  }
}
