import { CreateZoneRequest, UpdateZoneRequest, ZoneDTO, floorplan, zoneToFloorSpace } from '../../src';

const polygon: floorplan.Polygon = [[0, 0], [2, 0], [2, 2], [0, 2]];
const zone: ZoneDTO = { id: 'z1', tenantId: 'tenant', name: 'Salón', sortOrder: 1, polygon };

test('convierte una zona con polígono en espacio del plano conservando metros e identidad', () => {
  expect(zoneToFloorSpace(zone)).toEqual({ id: 'z1', name: 'Salón', polygon });
});

test('una zona antigua sin polígono no representa un espacio del plano', () => {
  expect(zoneToFloorSpace({ id: 'z2', tenantId: 'tenant', name: 'Terraza', sortOrder: 2 })).toBeNull();
});

test('creación y actualización aceptan geometría o null para quitarla', () => {
  const create: CreateZoneRequest = { name: 'Patio', polygon };
  const update: UpdateZoneRequest = { polygon: null };
  expect(create.polygon).toEqual(polygon);
  expect(update.polygon).toBeNull();
});
