import type { FloorSpace } from '../floorplan/rules';
import type { ZoneDTO } from './dtos';

export function zoneToFloorSpace(zone: ZoneDTO): FloorSpace | null {
  return zone.polygon === undefined ? null : { id: zone.id, name: zone.name, polygon: zone.polygon };
}
