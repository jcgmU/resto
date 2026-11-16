import request from 'supertest';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
  InMemoryZoneRepository,
  InMemoryReservationRepository,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';
import { SessionEventPublisherPort, SessionEvent } from '../../src/domain/events';
import { DeleteZoneUseCaseImpl } from '../../src/application/ZoneUseCases';

describe('U5: Nuevas reglas de mesas, lotes, zonas, eventos y D2', () => {
  const tenantId = 'tenant-u5-test';

  class FakeEventPublisher implements SessionEventPublisherPort {
    public events: Array<{ tenantId: string; event: SessionEvent }> = [];

    async publishSessionEvent(tId: string, event: SessionEvent): Promise<void> {
      this.events.push({ tenantId: tId, event });
    }
  }

  function setupApp() {
    const tableRepo = new InMemoryTableRepository();
    const sessionRepo = new InMemoryTableSessionRepository();
    const zoneRepo = new InMemoryZoneRepository();
    const reservationRepo = new InMemoryReservationRepository();
    const eventPublisher = new FakeEventPublisher();

    tableRepo.tables = [];
    sessionRepo.sessions = [];
    zoneRepo.zones = [];
    reservationRepo.reservations = [];

    tableRepo.setSessionRepository(sessionRepo);

    // Seed a valid zone
    zoneRepo.zones.push({
      id: 'zone-valid',
      tenantId,
      name: 'Zona Valida',
      sortOrder: 1,
    });

    const app = createSessionApp({
      tableRepo,
      sessionRepo,
      zoneRepo,
      reservationRepo,
      eventPublisher,
    });

    return { app, tableRepo, sessionRepo, zoneRepo, reservationRepo, eventPublisher };
  }

  // 1. Lote con zoneId inexistente -> rechaza con ZONE_NOT_FOUND (404)
  test('1. Lote POST /tables/batch con zoneId inexistente -> rechaza con ZONE_NOT_FOUND (404)', async () => {
    const { app } = setupApp();

    const res = await request(app)
      .post('/tables/batch')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        prefix: 'Mesa',
        count: 2,
        zoneId: 'zone-non-existent',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ZONE_NOT_FOUND');
  });

  // 2. Baja con sesión activa -> rechaza con TABLE_HAS_ACTIVE_SESSION (409)
  test('2. Baja por lote POST /tables/batch/delete con sesión activa -> incluye en failed con TABLE_HAS_ACTIVE_SESSION o 409', async () => {
    const { app, tableRepo, sessionRepo } = setupApp();

    await tableRepo.save(tenantId, {
      tableId: 'tb-active-session',
      tenantId,
      label: 'Mesa Con Sesion',
      status: 'OCCUPIED',
      zoneId: 'zone-valid',
      qrKey: 'qr-1',
      createdAt: new Date().toISOString(),
    });

    sessionRepo.sessions.push({
      sessionId: 'sess-active-1',
      tenantId,
      tableId: 'tb-active-session',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    const res = await request(app)
      .post('/tables/batch/delete')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        tableIds: ['tb-active-session'],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLES_NOT_DELETABLE');
    expect(res.body.error.details.failed).toEqual([
      { tableId: 'tb-active-session', code: 'TABLE_HAS_ACTIVE_SESSION' },
    ]);
  });

  // 3. Baja con reserva futura (D2) -> rechaza con TABLE_HAS_RESERVATIONS (sin cancelar la reserva)
  test('3. Baja por lote y unitaria con reserva futura (D2) -> rechaza con TABLE_HAS_RESERVATIONS sin cancelar reserva', async () => {
    const { app, tableRepo, reservationRepo } = setupApp();

    await tableRepo.save(tenantId, {
      tableId: 'tb-with-reservation',
      tenantId,
      label: 'Mesa Con Reserva',
      status: 'RESERVED',
      zoneId: 'zone-valid',
      qrKey: 'qr-res-1',
      createdAt: new Date().toISOString(),
    });

    // Reserva futura activa
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await reservationRepo.save(tenantId, {
      id: 'res-future-1',
      tenantId,
      tableId: 'tb-with-reservation',
      customerName: 'Cliente VIP',
      phone: '3001234567',
      partySize: 4,
      reservedFor: futureDate,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Intento 1: Unitario DELETE /tables/:id -> 409 TABLE_HAS_RESERVATIONS
    const unitRes = await request(app)
      .delete('/tables/tb-with-reservation')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin');

    expect(unitRes.status).toBe(409);
    expect(unitRes.body.error.code).toBe('TABLE_HAS_RESERVATIONS');

    // Comprobar que la reserva sigue intacta (no se canceló en silencio)
    const resStill = await reservationRepo.findById(tenantId, 'res-future-1');
    expect(resStill).not.toBeNull();
    expect(resStill!.status).toBe('active');

    // Intento 2: Lote POST /tables/batch/delete -> 409 TABLES_NOT_DELETABLE con failed code TABLE_HAS_RESERVATIONS
    const batchRes = await request(app)
      .post('/tables/batch/delete')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        tableIds: ['tb-with-reservation'],
      });

    expect(batchRes.status).toBe(409);
    expect(batchRes.body.error.code).toBe('TABLES_NOT_DELETABLE');
    expect(batchRes.body.error.details.failed).toEqual([
      { tableId: 'tb-with-reservation', code: 'TABLE_HAS_RESERVATIONS' },
    ]);
  });

  // 4. Lotes y baja que publican evento table:status-changed por cada mesa afectada
  test('4. Lotes (create, update, delete) publican evento table:status-changed por cada mesa', async () => {
    const { app, eventPublisher } = setupApp();

    // Alta por lote
    const createRes = await request(app)
      .post('/tables/batch')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        labels: ['Mesa Eventos 1', 'Mesa Eventos 2'],
        zoneId: 'zone-valid',
      });

    expect(createRes.status).toBe(201);
    const table1Id = createRes.body.tables[0].tableId;
    const table2Id = createRes.body.tables[1].tableId;

    const createEvents = eventPublisher.events.filter(
      (e) => e.event.event === 'table:status-changed' && (e.event.tableId === table1Id || e.event.tableId === table2Id)
    );
    expect(createEvents).toHaveLength(2);

    // Update por lote
    eventPublisher.events = [];
    const updateRes = await request(app)
      .patch('/tables/batch')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        updates: [
          { tableId: table1Id, label: 'Mesa Eventos 1 Mod' },
          { tableId: table2Id, label: 'Mesa Eventos 2 Mod' },
        ],
      });

    expect(updateRes.status).toBe(200);
    const updateEvents = eventPublisher.events.filter(
      (e) => e.event.event === 'table:status-changed' && (e.event.tableId === table1Id || e.event.tableId === table2Id)
    );
    expect(updateEvents).toHaveLength(2);

    // Baja por lote
    eventPublisher.events = [];
    const deleteRes = await request(app)
      .post('/tables/batch/delete')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin')
      .send({
        tableIds: [table1Id, table2Id],
      });

    expect(deleteRes.status).toBe(200);
    const deleteEvents = eventPublisher.events.filter(
      (e) => e.event.event === 'table:status-changed' && (e.event.tableId === table1Id || e.event.tableId === table2Id)
    );
    expect(deleteEvents).toHaveLength(2);
  });

  // 5. DELETE /v1/tables/:tableId unitario actúa como baja lógica (status: deleted, deletedAt, rota QR a 16 bytes, publica evento)
  test('5. DELETE /tables/:tableId unitario actúa como baja lógica y rota QR a 16 bytes', async () => {
    const { app, tableRepo, eventPublisher } = setupApp();

    const originalTable = await tableRepo.save(tenantId, {
      tableId: 'tb-unit-del',
      tenantId,
      label: 'Mesa Unitaria Del',
      status: 'AVAILABLE',
      zoneId: 'zone-valid',
      qrKey: 'qr-old-key-1',
      createdAt: new Date().toISOString(),
    });

    const delRes = await request(app)
      .delete('/tables/tb-unit-del')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin');

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verificar en repositorio: status === 'deleted', deletedAt presente, QR rotado con 32 hex chars (16 bytes)
    const stored = (tableRepo as InMemoryTableRepository).tables.find((t) => t.tableId === 'tb-unit-del');
    expect(stored).toBeDefined();
    expect(stored!.status).toBe('deleted');
    expect(stored!.deletedAt).toBeDefined();
    expect(stored!.qrKey).not.toBe('qr-old-key-1');
    expect(stored!.qrKey).toHaveLength(32); // 16 bytes hex

    // No se lista en GET /tables
    const listRes = await request(app)
      .get('/tables')
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'admin');
    expect(listRes.body.some((t: any) => t.tableId === 'tb-unit-del')).toBe(false);

    // Publicó evento table:status-changed
    const delEvent = eventPublisher.events.find(
      (e) => e.event.event === 'table:status-changed' && e.event.tableId === 'tb-unit-del'
    );
    expect(delEvent).toBeDefined();
  });

  // 6. Borrar zona ignora mesas con baja lógica (deleted)
  test('6. Borrar zona ignora mesas dadas de baja lógica (deleted)', async () => {
    const { tableRepo, zoneRepo } = setupApp();

    // Mesa dada de baja lógica en zone-valid
    await tableRepo.save(tenantId, {
      tableId: 'tb-soft-deleted-in-zone',
      tenantId,
      label: 'Mesa Borrada',
      status: 'deleted',
      deletedAt: new Date().toISOString(),
      zoneId: 'zone-valid',
      qrKey: 'qr-deleted',
      createdAt: new Date().toISOString(),
    });

    const deleteZoneUseCase = new DeleteZoneUseCaseImpl(zoneRepo, tableRepo);

    // Debe permitirse eliminar la zona porque la única mesa en ella está en baja lógica
    await expect(deleteZoneUseCase.execute({ tenantId, zoneId: 'zone-valid' })).resolves.toBeUndefined();

    const zoneAfter = await zoneRepo.findById(tenantId, 'zone-valid');
    expect(zoneAfter).toBeNull();
  });
});
