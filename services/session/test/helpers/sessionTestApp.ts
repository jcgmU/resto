import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
  InMemoryZoneRepository,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

export function createSeededSessionTestApp() {
  const sessionRepo = new InMemoryTableSessionRepository();
  const zoneRepo = new InMemoryZoneRepository();
  const tableRepo = new InMemoryTableRepository(sessionRepo);

  zoneRepo.zones.push({
    id: 'zone-1',
    tenantId: 'tenant-100',
    name: 'Zona Demo',
    sortOrder: 1,
  });

  tableRepo.tables.push({
    tableId: 'table-1',
    tenantId: 'tenant-100',
    label: 'Mesa Seed 1',
    labelKey: 'mesa seed 1',
    zoneId: 'zone-1',
    capacity: 4,
    status: 'active',
    qrKey: 'valid-key',
    createdAt: new Date().toISOString(),
  });

  return createSessionApp({
    tableRepo,
    sessionRepo,
    zoneRepo,
  });
}
