import { InMemoryTableRepository, InMemoryTableSessionRepository } from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

export function createSeededSessionTestApp() {
  const sessionRepo = new InMemoryTableSessionRepository();
  const tableRepo = new InMemoryTableRepository(sessionRepo);

  tableRepo.tables.push({
    tableId: 'table-1',
    tenantId: 'tenant-100',
    label: 'Mesa Seed 1',
    labelKey: 'mesa seed 1',
    status: 'active',
    qrKey: 'valid-key',
    createdAt: new Date().toISOString(),
  });

  return createSessionApp({
    tableRepo,
    sessionRepo,
  });
}
