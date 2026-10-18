import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
  InMemoryZoneRepository,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

export function createSeededSessionTestApp() {
  const tableRepo = new InMemoryTableRepository();
  const sessionRepo = new InMemoryTableSessionRepository();
  const zoneRepo = new InMemoryZoneRepository();

  zoneRepo.zones.push({
    id: 'zone-1',
    tenantId: 'tenant-100',
    name: 'Zona Demo',
    sortOrder: 1,
  });

  tableRepo.tables.push({
    tableId: 'table-1',
    tenantId: 'tenant-100',
    label: 'Mesa 1',
    zoneId: 'zone-1',
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
