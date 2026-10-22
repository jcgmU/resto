import {
  ensureContractEnv,
  getTestRedis,
  flushSessionRedis,
  disconnectTestRedis,
} from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import { RedisZoneRepository } from '../../src/infrastructure/redis/RedisZoneRepository';
import { RedisReservationRepository } from '../../src/infrastructure/redis/RedisReservationRepository';
import { createSessionApp } from '../../src/app';
import request from 'supertest';

describe('V18 Zonas, Capacidad de Mesas, Reservas y Eliminación Protegida (Contract Test con Redis Real db2)', () => {
  let redis: any;
  let tableRepo: RedisTableRepository;
  let sessionRepo: RedisTableSessionRepository;
  let zoneRepo: RedisZoneRepository;
  let reservationRepo: RedisReservationRepository;
  let app: any;

  const tenantId = 'tenant-v18-test';

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    sessionRepo = new RedisTableSessionRepository(redis);
    zoneRepo = new RedisZoneRepository(redis);
    reservationRepo = new RedisReservationRepository(redis);

    app = createSessionApp({
      redis,
      tableRepo,
      sessionRepo,
      zoneRepo,
      reservationRepo,
    });
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();
  });

  describe('1. CRUD de Zonas y Bloqueo de Borrado', () => {
    test('Control de acceso: creación y modificación de zonas exige admin/manager; lectura exige staff+', async () => {
      // POST sin rol -> 403
      const noRoleCreate = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .send({ name: 'Terraza', sortOrder: 1 });
      expect(noRoleCreate.status).toBe(403);

      // POST con staff (no admin/manager) -> 403
      const staffCreate = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ name: 'Terraza', sortOrder: 1 });
      expect(staffCreate.status).toBe(403);

      // GET sin rol -> 403
      const noRoleGet = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId);
      expect(noRoleGet.status).toBe(403);

      // GET con staff -> 200
      const staffGet = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(staffGet.status).toBe(200);
      expect(staffGet.body).toEqual([]);
    });

    test('CRUD completo de zonas: POST, GET ordenado por sortOrder, PATCH y DELETE', async () => {
      // Crear Zona 1 (sortOrder 2)
      const resZ2 = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ name: 'Salón Principal', sortOrder: 2 });
      expect(resZ2.status).toBe(201);
      expect(resZ2.body.id).toBeDefined();
      expect(resZ2.body.name).toBe('Salón Principal');
      expect(resZ2.body.sortOrder).toBe(2);

      // Crear Zona 2 (sortOrder 1)
      const resZ1 = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'manager')
        .send({ name: 'Terraza', sortOrder: 1 });
      expect(resZ1.status).toBe(201);
      expect(resZ1.body.name).toBe('Terraza');
      expect(resZ1.body.sortOrder).toBe(1);

      // GET /zones -> deben venir ordenadas por sortOrder: Terraza (1) primero, Salón Principal (2) después
      const listRes = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(2);
      expect(listRes.body[0].name).toBe('Terraza');
      expect(listRes.body[1].name).toBe('Salón Principal');

      // PATCH /zones/:id -> actualizar nombre y sortOrder
      const patchRes = await request(app)
        .patch(`/zones/${resZ1.body.id}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ name: 'Terraza Exterior', sortOrder: 0 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe('Terraza Exterior');
      expect(patchRes.body.sortOrder).toBe(0);

      // DELETE /zones/:id sin mesas -> 200
      const delRes = await request(app)
        .delete(`/zones/${resZ2.body.id}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const listAfterDel = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(listAfterDel.body).toHaveLength(1);
      expect(listAfterDel.body[0].id).toBe(resZ1.body.id);
    });

    test('U7 [R2]: Asignación mesero↔ZONA con staffIds en creación, lectura y actualización', async () => {
      // 1. Crear zona con staffIds
      const createRes = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ name: 'Zona VIP', sortOrder: 5, staffIds: ['mesero-1', 'mesero-2'] });
      expect(createRes.status).toBe(201);
      expect(createRes.body.staffIds).toEqual(['mesero-1', 'mesero-2']);

      const zoneId = createRes.body.id;

      // 2. Lectura permitida para rol waiter y preserva staffIds
      const waiterGetRes = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'waiter');
      expect(waiterGetRes.status).toBe(200);
      const vipZone = waiterGetRes.body.find((z: any) => z.id === zoneId);
      expect(vipZone).toBeDefined();
      expect(vipZone.staffIds).toEqual(['mesero-1', 'mesero-2']);

      // 3. PATCH actualiza staffIds
      const patchRes = await request(app)
        .patch(`/zones/${zoneId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ staffIds: ['mesero-3'] });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.staffIds).toEqual(['mesero-3']);

      // 4. Verificar persistencia tras relectura
      const reread = await request(app)
        .get('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      const updatedVip = reread.body.find((z: any) => z.id === zoneId);
      expect(updatedVip.staffIds).toEqual(['mesero-3']);
    });

    test('DELETE /zones/:id bloqueado con 409 si la zona tiene mesas asignadas', async () => {
      // 1. Crear zona
      const zoneRes = await request(app)
        .post('/zones')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ name: 'Barra', sortOrder: 3 });
      const zoneId = zoneRes.body.id;

      // 2. Crear mesa asignada a la zona
      const tableRes = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Barra 1', zoneId, capacity: 2 });
      expect(tableRes.status).toBe(201);
      expect(tableRes.body.zoneId).toBe(zoneId);

      // 3. Intentar eliminar la zona con mesas -> 409 ZONE_HAS_TABLES
      const delConflict = await request(app)
        .delete(`/zones/${zoneId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delConflict.status).toBe(409);
      expect(delConflict.body.error).toBeDefined();
      expect(delConflict.body.error.code).toBe('ZONE_HAS_TABLES');

      // 4. Reasignar la mesa a otra zona o quitar zoneId
      await request(app)
        .patch(`/tables/${tableRes.body.tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ zoneId: '' });

      // 5. Ahora la zona se puede eliminar -> 200
      const delSuccess = await request(app)
        .delete(`/zones/${zoneId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delSuccess.status).toBe(200);
      expect(delSuccess.body.success).toBe(true);
    });
  });

  describe('2. Mesas con zoneId, capacity y validación de enum status', () => {
    let testZoneId: string;

    beforeEach(async () => {
      const z = await zoneRepo.save(tenantId, {
        id: `zone-contract-test-${Date.now()}`,
        tenantId,
        name: 'Zona Contract',
        sortOrder: 1,
      });
      testZoneId = z.id;
    });

    test('POST /tables exige zoneId obligatorio (400 VALIDATION_ERROR si falta)', async () => {
      const res = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Sin Zona' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('Creación de mesa valida zoneId y capacity; asigna capacity default 4', async () => {
      // zoneId inexistente -> 400
      const badZone = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 1', zoneId: 'non-existent-zone' });
      expect(badZone.status).toBe(400);

      // capacity inválida (negativa o 0 o no entero) -> 400
      const badCapacity = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 1', zoneId: testZoneId, capacity: 0 });
      expect(badCapacity.status).toBe(400);

      // Sin capacity especificada -> default 4
      const defaultTable = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Sin Capacidad', zoneId: testZoneId });
      expect(defaultTable.status).toBe(201);
      expect(defaultTable.body.capacity).toBe(4);
      expect(defaultTable.body.status).toBe('AVAILABLE');

      // Con capacity positiva explícita
      const explicitTable = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 6 Puestos', zoneId: testZoneId, capacity: 6 });
      expect(explicitTable.status).toBe(201);
      expect(explicitTable.body.capacity).toBe(6);
    });

    test('Consistencia de enum status entre POST y PATCH /tables ("AVAILABLE"|"OCCUPIED"|"RESERVED"|"DISABLED") o 400', async () => {
      // POST con status inválido -> 400
      const badPost = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Bad Post', zoneId: testZoneId, status: 'INVALID_STATUS' });
      expect(badPost.status).toBe(400);
      expect(badPost.body.error.code).toBe('VALIDATION_ERROR');

      // POST con status 'available' (minúsculas) -> 201 y normalizado a 'AVAILABLE'
      const postAvailable = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Lowercase Available', zoneId: testZoneId, status: 'available' });
      expect(postAvailable.status).toBe(201);
      expect(postAvailable.body.status).toBe('AVAILABLE');

      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Estado Test', zoneId: testZoneId });
      const tableId = created.body.tableId;

      // Status inválido en PATCH -> 400
      const badStatus = await request(app)
        .patch(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ status: 'INVALID_STATUS' });
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.error.code).toBe('VALIDATION_ERROR');

      // Status 'disabled' (minúsculas) en PATCH -> 200 y 'DISABLED'
      const setDisabledLower = await request(app)
        .patch(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ status: 'disabled' });
      expect(setDisabledLower.status).toBe(200);
      expect(setDisabledLower.body.status).toBe('DISABLED');

      // Mesa DISABLED no permite abrir sesión -> 400 TABLE_INACTIVE
      const tableWithQr = await tableRepo.findById(tenantId, tableId);
      const openDisabled = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey: tableWithQr!.qrKey });
      expect(openDisabled.status).toBe(400);
      expect(openDisabled.body.error.code).toBe('TABLE_INACTIVE');

      // Status 'AVAILABLE' (mayúsculas) en PATCH -> 200
      const setAvailable = await request(app)
        .patch(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ status: 'AVAILABLE' });
      expect(setAvailable.status).toBe(200);
      expect(setAvailable.body.status).toBe('AVAILABLE');

      // Ahora sí permite abrir sesión
      const openAvailable = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey: tableWithQr!.qrKey });
      expect(openAvailable.status).toBe(200);
    });
  });

  describe('3. DELETE /tables/:id Protegido y Bloqueado con Sesión o Reserva Activa', () => {
    let delZoneId: string;

    beforeEach(async () => {
      const z = await zoneRepo.save(tenantId, {
        id: `zone-del-${Date.now()}`,
        tenantId,
        name: 'Zona Delete Tests',
        sortOrder: 1,
      });
      delZoneId = z.id;
    });

    test('DELETE /tables/:id protegido para admin/manager', async () => {
      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Protegida', zoneId: delZoneId });
      const tableId = created.body.tableId;

      // Sin rol -> 403
      const noRole = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId);
      expect(noRole.status).toBe(403);

      // Con rol staff -> 403
      const staffRole = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(staffRole.status).toBe(403);
    });

    test('DELETE /tables/:id bloqueado con 409 si la mesa tiene sesión activa', async () => {
      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Con Sesión', zoneId: delZoneId });
      const tableId = created.body.tableId;
      const tableWithQr = await tableRepo.findById(tenantId, tableId);

      // Abrir sesión en la mesa
      const openRes = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey: tableWithQr!.qrKey });
      expect(openRes.status).toBe(200);
      const sessionId = openRes.body.session.sessionId;

      // Intentar eliminar la mesa -> 409 TABLE_HAS_ACTIVE_SESSION
      const delRes = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('TABLE_HAS_ACTIVE_SESSION');

      // Cerrar la sesión
      await request(app)
        .patch(`/sessions/${sessionId}/close`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      // Ahora sí se puede eliminar la mesa
      const delSuccess = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delSuccess.status).toBe(200);
      expect(delSuccess.body.success).toBe(true);

      const notFound = await tableRepo.findById(tenantId, tableId);
      expect(notFound).toBeNull();
    });

    test('DELETE /tables/:id bloqueado con 409 si la mesa tiene reserva activa', async () => {
      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Con Reserva', zoneId: delZoneId });
      const tableId = created.body.tableId;

      // Crear reserva activa
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resCreate = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId,
          customerName: 'Juan Pérez',
          phone: '3109876543',
          partySize: 4,
          reservedFor: tomorrow,
        });
      expect(resCreate.status).toBe(201);
      const reservationId = resCreate.body.id;

      // Intentar eliminar la mesa -> 409 TABLE_HAS_ACTIVE_RESERVATION
      const delRes = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('TABLE_HAS_ACTIVE_RESERVATION');

      // Cancelar la reserva
      await request(app)
        .patch(`/reservations/${reservationId}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      // Ahora sí se puede eliminar la mesa
      const delSuccess = await request(app)
        .delete(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(delSuccess.status).toBe(200);
      expect(delSuccess.body.success).toBe(true);
    });
  });

  describe('4. CRUD de Reservas y Endpoint Seat ("Cliente Llegó")', () => {
    test('CRUD de reservas: validaciones, creación, listado con filtros y cancelación', async () => {
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-res-crud',
        tenantId,
        label: 'Mesa Reservas',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey: 'qr-res-crud',
        createdAt: new Date().toISOString(),
      });

      // Validaciones en POST /reservations
      const badTable = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: 'mesa-inexistente',
          customerName: 'Ana',
          phone: '3001112233',
          partySize: 2,
          reservedFor: new Date().toISOString(),
        });
      expect(badTable.status).toBe(404);
      expect(badTable.body.error.code).toBe('TABLE_NOT_FOUND');

      const badParty = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Ana',
          phone: '3001112233',
          partySize: -1,
          reservedFor: new Date().toISOString(),
        });
      expect(badParty.status).toBe(400);

      // Crear reserva exitosa
      const resDate = new Date(Date.now() + 3600 * 1000).toISOString();
      const createRes = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Ana Ruiz',
          phone: '3001112233',
          partySize: 3,
          reservedFor: resDate,
          notes: 'Cerca a la ventana',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('active');
      expect(createRes.body.notes).toBe('Cerca a la ventana');
      const resId = createRes.body.id;

      // GET /reservations con filtro tableId
      const listTable = await request(app)
        .get(`/reservations?tableId=${table.tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(listTable.status).toBe(200);
      expect(listTable.body).toHaveLength(1);
      expect(listTable.body[0].id).toBe(resId);

      // Cancelar reserva -> status = cancelled
      const cancelRes = await request(app)
        .patch(`/reservations/${resId}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('cancelled');
    });

    test('POST /reservations/:id/seat cambia estado a seated y abre la sesión de la mesa', async () => {
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-seat-test',
        tenantId,
        label: 'Mesa Seat',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey: 'qr-seat-test',
        createdAt: new Date().toISOString(),
      });

      const resDate = new Date(Date.now() + 1800 * 1000).toISOString();
      const createRes = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Santiago L.',
          phone: '3205556677',
          partySize: 2,
          reservedFor: resDate,
        });
      const resId = createRes.body.id;

      // Ejecutar seat ("Cliente Llegó")
      const seatRes = await request(app)
        .post(`/reservations/${resId}/seat`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      expect(seatRes.status).toBe(200);
      expect(seatRes.body.reservation).toBeDefined();
      expect(seatRes.body.reservation.status).toBe('seated');
      expect(seatRes.body.session).toBeDefined();
      expect(seatRes.body.session.status).toBe('active');
      expect(seatRes.body.session.tableId).toBe(table.tableId);

      // Verificar en Redis real: la sesión quedó registrada y vinculada a la mesa
      const activeSession = await sessionRepo.findActiveByTable(tenantId, table.tableId);
      expect(activeSession).not.toBeNull();
      expect(activeSession?.sessionId).toBe(seatRes.body.session.sessionId);
    });

    test('Estado visual: mesa con reserva active para hoy se refleja como RESERVED en GET /tables', async () => {
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-visual-test',
        tenantId,
        label: 'Mesa Visual State',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey: 'qr-visual-test',
        createdAt: new Date().toISOString(),
      });

      // Inicialmente en GET /tables se ve AVAILABLE
      const getInitial = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableInitial = getInitial.body.find((t: any) => t.tableId === table.tableId);
      expect(tableInitial.status).toBe('AVAILABLE');

      // Crear reserva active para HOY (dentro de 4 horas)
      const todayReservation = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      const resCreate = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Visual State User',
          phone: '3000000000',
          partySize: 4,
          reservedFor: todayReservation,
        });
      const resId = resCreate.body.id;

      // En GET /tables ahora se debe reflejar como RESERVED
      const getAfterRes = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableAfterRes = getAfterRes.body.find((t: any) => t.tableId === table.tableId);
      expect(tableAfterRes.status).toBe('RESERVED');

      // Cancelar la reserva -> debe volver a reflejarse AVAILABLE
      await request(app)
        .patch(`/reservations/${resId}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      const getAfterCancel = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableAfterCancel = getAfterCancel.body.find((t: any) => t.tableId === table.tableId);
      expect(tableAfterCancel.status).toBe('AVAILABLE');
    });

    test('PATCH /reservations/:id (staff) permite modificar customerName, phone, partySize, reservedFor, notes con validaciones', async () => {
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-res-patch',
        tenantId,
        label: 'Mesa Patch Reserva',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey: 'qr-res-patch',
        createdAt: new Date().toISOString(),
      });

      const initialDate = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      const createdRes = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Carlos M.',
          phone: '3001234567',
          partySize: 2,
          reservedFor: initialDate,
          notes: 'Nota inicial',
        });
      expect(createdRes.status).toBe(201);
      const resId = createdRes.body.id;

      // 1. Control de acceso: sin rol staff -> 403
      const noRolePatch = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .send({ customerName: 'Intento Sin Rol' });
      expect(noRolePatch.status).toBe(403);

      // 2. Reserva inexistente -> 404
      const notFoundPatch = await request(app)
        .patch('/reservations/res-non-existent')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ customerName: 'Nuevo Nombre' });
      expect(notFoundPatch.status).toBe(404);
      expect(notFoundPatch.body.error.code).toBe('RESERVATION_NOT_FOUND');

      // 3. Validaciones de ventana / campos inválidos -> 400
      const badDatePatch = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ reservedFor: 'fecha-invalida' });
      expect(badDatePatch.status).toBe(400);
      expect(badDatePatch.body.error.code).toBe('VALIDATION_ERROR');

      const badPartyPatch = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ partySize: 0 });
      expect(badPartyPatch.status).toBe(400);

      const emptyNamePatch = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ customerName: '   ' });
      expect(emptyNamePatch.status).toBe(400);

      const emptyPhonePatch = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({ phone: '' });
      expect(emptyPhonePatch.status).toBe(400);

      // 4. Edición exitosa de todos los campos permitidos -> 200
      const updatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
      const patchSuccess = await request(app)
        .patch(`/reservations/${resId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          customerName: 'Carlos Mendoza',
          phone: '3119876543',
          partySize: 4,
          reservedFor: updatedDate,
          notes: 'Mesa alta cerca al bar',
        });
      expect(patchSuccess.status).toBe(200);
      expect(patchSuccess.body.customerName).toBe('Carlos Mendoza');
      expect(patchSuccess.body.phone).toBe('3119876543');
      expect(patchSuccess.body.partySize).toBe(4);
      expect(new Date(patchSuccess.body.reservedFor).getTime()).toBe(new Date(updatedDate).getTime());
      expect(patchSuccess.body.notes).toBe('Mesa alta cerca al bar');

      // 5. Verificar persistencia en Redis real
      const persisted = await reservationRepo.findById(tenantId, resId);
      expect(persisted).not.toBeNull();
      expect(persisted?.customerName).toBe('Carlos Mendoza');
      expect(persisted?.partySize).toBe(4);
      expect(persisted?.notes).toBe('Mesa alta cerca al bar');
    });

    test('Prioridad de estados en GET /tables: disabled > occupied (sesión viva) > reserved (reserva active hoy) > available; RESERVED NO pisa OCCUPIED', async () => {
      const z = await zoneRepo.save(tenantId, {
        id: `zone-prio-${Date.now()}`,
        tenantId,
        name: 'Zona Prioridad',
        sortOrder: 1,
      });

      const tableRes = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Prioridad Ocupada', zoneId: z.id, capacity: 4 });
      const tableId = tableRes.body.tableId;
      const tableWithQr = await tableRepo.findById(tenantId, tableId);

      // 1. Abrir sesión viva -> mesa pasa a ocupada
      const openRes = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey: tableWithQr!.qrKey });
      expect(openRes.status).toBe(200);
      const sessionId = openRes.body.session.sessionId;

      // 2. Crear reserva active para HOY en la misma mesa
      const todayReservation = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
      await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId,
          customerName: 'Cliente Reserva y Ocupada',
          phone: '3007778899',
          partySize: 4,
          reservedFor: todayReservation,
        });

      // 3. GET /tables: con sesión viva y reserva hoy -> DEBE ser OCCUPIED (RESERVED ya NO pisa OCCUPIED)
      const getTablesOcc = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(getTablesOcc.status).toBe(200);
      const tableOcc = getTablesOcc.body.find((t: any) => t.tableId === tableId);
      expect(tableOcc.status).toBe('OCCUPIED');

      // 4. Si la mesa se marca como DISABLED, disabled tiene máxima prioridad sobre occupied y reserved
      await request(app)
        .patch(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ status: 'DISABLED' });

      const getTablesDis = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableDis = getTablesDis.body.find((t: any) => t.tableId === tableId);
      expect(tableDis.status).toBe('DISABLED');

      // Restaurar status AVAILABLE
      await request(app)
        .patch(`/tables/${tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ status: 'AVAILABLE' });

      // Sigue teniendo sesión viva -> vuelve a OCCUPIED
      const getTablesOccAgain = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableOccAgain = getTablesOccAgain.body.find((t: any) => t.tableId === tableId);
      expect(tableOccAgain.status).toBe('OCCUPIED');

      // 5. Cerrar la sesión -> ahora ya no tiene sesión viva, pero conserva la reserva active de hoy -> RESERVED
      await request(app)
        .patch(`/sessions/${sessionId}/close`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      const getTablesRes = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      const tableResAfter = getTablesRes.body.find((t: any) => t.tableId === tableId);
      expect(tableResAfter.status).toBe('RESERVED');
    });
  });

  describe('5. Política QR con Reserva (Ventana [-30m, +2h])', () => {
    test('409 TABLE_RESERVED si la reserva active está dentro de [ahora - 30m, ahora + 2h]', async () => {
      const qrKey = 'qr-window-test';
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-window-test',
        tenantId,
        label: 'Mesa Ventana QR',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey,
        createdAt: new Date().toISOString(),
      });

      // 1. Reserva 1 hora en el futuro (dentro de [-30m, +2h]) -> bloquea apertura QR
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res1 = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Cliente Dentro Ventana',
          phone: '3112223344',
          partySize: 2,
          reservedFor: inOneHour,
        });

      const qrAttempt1 = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId: table.tableId, qrKey });

      expect(qrAttempt1.status).toBe(409);
      expect(qrAttempt1.body.error).toBeDefined();
      expect(qrAttempt1.body.error.code).toBe('TABLE_RESERVED');

      // Cancelar reserva 1
      await request(app)
        .patch(`/reservations/${res1.body.id}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      // 2. Reserva 15 minutos en el pasado (dentro de [-30m, +2h]) -> también bloquea
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const res2 = await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Cliente Pasado Reciente',
          phone: '3112223344',
          partySize: 2,
          reservedFor: fifteenMinsAgo,
        });

      const qrAttempt2 = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId: table.tableId, qrKey });

      expect(qrAttempt2.status).toBe(409);
      expect(qrAttempt2.body.error.code).toBe('TABLE_RESERVED');

      // Cancelar reserva 2
      await request(app)
        .patch(`/reservations/${res2.body.id}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
    });

    test('200 Permitido si la reserva active está fuera de la ventana [-30m, +2h]', async () => {
      const qrKey = 'qr-outside-window';
      const table = await tableRepo.save(tenantId, {
        tableId: 'tb-outside-window',
        tenantId,
        label: 'Mesa Fuera Ventana',
        status: 'AVAILABLE',
        capacity: 4,
        qrKey,
        createdAt: new Date().toISOString(),
      });

      // 1. Reserva 3 horas en el futuro (fuera de la ventana)
      const inThreeHours = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
      await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Cliente Lejano',
          phone: '3119998877',
          partySize: 2,
          reservedFor: inThreeHours,
        });

      // La apertura QR debe ser permitida (200)
      const qrOpenSuccess = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId: table.tableId, qrKey });

      expect(qrOpenSuccess.status).toBe(200);
      expect(qrOpenSuccess.body.session.status).toBe('active');
      expect(qrOpenSuccess.body.guestToken).toBeDefined();

      // Cerrar la sesión
      await request(app)
        .patch(`/sessions/${qrOpenSuccess.body.session.sessionId}/close`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');

      // 2. Reserva 45 minutos en el pasado (fuera de [-30m, +2h])
      const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      await request(app)
        .post('/reservations')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .send({
          tableId: table.tableId,
          customerName: 'Cliente Pasado Lejano',
          phone: '3119998877',
          partySize: 2,
          reservedFor: fortyFiveMinsAgo,
        });

      // La apertura QR debe ser permitida (200)
      const qrOpenSuccess2 = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId: table.tableId, qrKey });

      expect(qrOpenSuccess2.status).toBe(200);
      expect(qrOpenSuccess2.body.session.status).toBe('active');
    });
  });
});
