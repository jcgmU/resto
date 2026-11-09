import request from 'supertest';
import { createSeededSessionTestApp } from '../helpers/sessionTestApp';
import {
  InMemoryTableRepository,
  InMemoryTableSessionRepository,
} from '../../src/infrastructure/fakes/InMemorySessionAdapters';
import { createSessionApp } from '../../src/app';

describe('Tables Batch HTTP Integration Tests', () => {
  const tenantId = 'tenant-batch-test';

  function createFreshApp() {
    const tableRepo = new InMemoryTableRepository();
    const sessionRepo = new InMemoryTableSessionRepository();
    tableRepo.tables = [];
    const app = createSessionApp({ tableRepo, sessionRepo });
    return { app, tableRepo, sessionRepo };
  }

  describe('POST /tables/batch & POST /tables', () => {
    test('crea mesas en lote con { prefix, count, start } y con { labels } -> 201 { tables }', async () => {
      const { app } = createFreshApp();

      const resPrefix = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ prefix: 'Terraza', count: 3, start: 10 });

      expect(resPrefix.status).toBe(201);
      expect(resPrefix.body.tables).toHaveLength(3);
      expect(resPrefix.body.tables.map((t: any) => t.label)).toEqual([
        'Terraza 10',
        'Terraza 11',
        'Terraza 12',
      ]);
      expect(resPrefix.body.tables[0].qrKey).toBeUndefined();
      expect(resPrefix.body.tables[0].labelKey).toBeUndefined();

      const resLabels = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'manager')
        .send({ labels: ['Barra 1', 'Barra 2'] });

      expect(resLabels.status).toBe(201);
      expect(resLabels.body.tables).toHaveLength(2);
      expect(resLabels.body.tables.map((t: any) => t.label)).toEqual(['Barra 1', 'Barra 2']);
    });

    test('POST /tables/batch y POST /tables rechazan duplicados case/trim-insensitive -> 409 TABLE_LABEL_TAKEN con error.details.conflicts y 0 creadas', async () => {
      const { app } = createFreshApp();

      // Crear Mesa 1 inicial
      const resInit = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 1' });
      expect(resInit.status).toBe(201);

      // POST /tables con duplicado case/trim-insensitive
      const resSingleDup = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: '  mESA 1  ' });

      expect(resSingleDup.status).toBe(409);
      expect(resSingleDup.body.error.code).toBe('TABLE_LABEL_TAKEN');
      expect(resSingleDup.body.error.details?.conflicts).toContain('mesa 1');

      // POST /tables/batch donde una colisiona con Mesa 1 -> 0 creadas del lote
      const resBatchDup = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ labels: ['Mesa Nueva', '  MESA 1 '] });

      expect(resBatchDup.status).toBe(409);
      expect(resBatchDup.body.error.code).toBe('TABLE_LABEL_TAKEN');
      expect(resBatchDup.body.error.details?.conflicts).toContain('mesa 1');

      // Verificar que 'Mesa Nueva' no se creó
      const listRes = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].label).toBe('Mesa 1');
    });
  });

  describe('PATCH /tables/batch & PATCH /tables/:tableId', () => {
    test('PATCH /tables/batch permite swap A <-> B -> 200 { tables }', async () => {
      const { app } = createFreshApp();

      const created = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ labels: ['Mesa A', 'Mesa B'] });

      const [tableA, tableB] = created.body.tables;

      const swapRes = await request(app)
        .patch('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          updates: [
            { tableId: tableA.tableId, label: 'Mesa B', status: 'inactive' },
            { tableId: tableB.tableId, label: 'Mesa A' },
          ],
        });

      expect(swapRes.status).toBe(200);
      expect(swapRes.body.tables).toHaveLength(2);
      expect(swapRes.body.tables[0]).toMatchObject({
        tableId: tableA.tableId,
        label: 'Mesa B',
        status: 'inactive',
      });
      expect(swapRes.body.tables[1]).toMatchObject({
        tableId: tableB.tableId,
        label: 'Mesa A',
        status: 'active',
      });
    });

    test('PATCH /tables/batch con status: deleted -> 400 VALIDATION_ERROR; con tableId inexistente o deleted -> 404 TABLE_NOT_FOUND', async () => {
      const { app } = createFreshApp();

      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 1' });
      const table1 = created.body;

      // status: 'deleted' -> 400 VALIDATION_ERROR
      const resInvalidStatus = await request(app)
        .patch('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          updates: [{ tableId: table1.tableId, status: 'deleted' }],
        });
      expect(resInvalidStatus.status).toBe(400);
      expect(resInvalidStatus.body.error.code).toBe('VALIDATION_ERROR');

      // tableId inexistente -> 404 TABLE_NOT_FOUND
      const resNotFound = await request(app)
        .patch('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          updates: [{ tableId: 'non-existent-id', label: 'Mesa X' }],
        });
      expect(resNotFound.status).toBe(404);
      expect(resNotFound.body.error.code).toBe('TABLE_NOT_FOUND');

      // Borrar table1 y luego intentar actualizarla -> 404 TABLE_NOT_FOUND
      const delRes = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ tableIds: [table1.tableId] });
      expect(delRes.status).toBe(200);

      const resDeletedUpdate = await request(app)
        .patch('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          updates: [{ tableId: table1.tableId, label: 'Mesa Revivida' }],
        });
      expect(resDeletedUpdate.status).toBe(404);
      expect(resDeletedUpdate.body.error.code).toBe('TABLE_NOT_FOUND');
    });

    test('PATCH /tables/:tableId individual -> 200 y conflicto de label -> 409 TABLE_LABEL_TAKEN', async () => {
      const { app } = createFreshApp();

      const created = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ labels: ['Mesa 1', 'Mesa 2'] });

      const [t1, t2] = created.body.tables;

      const patchOk = await request(app)
        .patch(`/tables/${t1.tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'manager')
        .send({ label: 'Mesa 1 VIP', status: 'inactive' });

      expect(patchOk.status).toBe(200);
      expect(patchOk.body).toMatchObject({
        tableId: t1.tableId,
        label: 'Mesa 1 VIP',
        status: 'inactive',
      });

      const patchConflict = await request(app)
        .patch(`/tables/${t2.tableId}`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'manager')
        .send({ label: '  mesa 1 vip  ' });

      expect(patchConflict.status).toBe(409);
      expect(patchConflict.body.error.code).toBe('TABLE_LABEL_TAKEN');
    });
  });

  describe('POST /tables/batch/delete', () => {
    test('lote mixto (1 libre + 1 con sesión activa + 1 no encontrada) -> 200 { deleted, failed }', async () => {
      const { app, tableRepo } = createFreshApp();

      const created = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ labels: ['Mesa Libre', 'Mesa Ocupada'] });

      const [freeTable, busyTable] = created.body.tables;
      const busyStored = await tableRepo.findById(tenantId, busyTable.tableId);

      // Abrir sesión en busyTable
      const openRes = await request(app)
        .post('/sessions/open')
        .send({
          tenantId,
          tableId: busyTable.tableId,
          qrKey: busyStored!.qrKey,
        });
      expect(openRes.status).toBe(200);

      const deleteRes = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          tableIds: [freeTable.tableId, busyTable.tableId, 'table-missing'],
        });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({
        deleted: [freeTable.tableId],
        failed: [
          { tableId: busyTable.tableId, code: 'TABLE_HAS_ACTIVE_SESSION' },
          { tableId: 'table-missing', code: 'TABLE_NOT_FOUND' },
        ],
      });
    });

    test('lote donde ninguna es borrable -> 409 TABLES_NOT_DELETABLE con error.details.failed', async () => {
      const { app, tableRepo } = createFreshApp();

      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Activa' });

      const stored = await tableRepo.findById(tenantId, created.body.tableId);
      await request(app).post('/sessions/open').send({
        tenantId,
        tableId: created.body.tableId,
        qrKey: stored!.qrKey,
      });

      const deleteRes = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({
          tableIds: [created.body.tableId, 'table-missing'],
        });

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error.code).toBe('TABLES_NOT_DELETABLE');
      expect(deleteRes.body.error.details).toEqual({
        deleted: [],
        failed: [
          { tableId: created.body.tableId, code: 'TABLE_HAS_ACTIVE_SESSION' },
          { tableId: 'table-missing', code: 'TABLE_NOT_FOUND' },
        ],
      });
    });

    test('mesa borrada desaparece de GET /tables, libera su label, y da 404 TABLE_NOT_FOUND en QR, rotate y POST /sessions/open', async () => {
      const { app, tableRepo } = createFreshApp();

      const created = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Temporal' });

      const tableId = created.body.tableId;
      const beforeDelete = await tableRepo.findById(tenantId, tableId);
      const oldQrKey = beforeDelete!.qrKey;

      const delRes = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ tableIds: [tableId] });
      expect(delRes.status).toBe(200);
      expect(delRes.body.deleted).toEqual([tableId]);

      // Desaparece de GET /tables
      const listRes = await request(app)
        .get('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toEqual([]);

      // 404 en GET /tables/:id/qr
      const qrRes = await request(app)
        .get(`/tables/${tableId}/qr`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff');
      expect(qrRes.status).toBe(404);
      expect(qrRes.body.error.code).toBe('TABLE_NOT_FOUND');

      // 404 en POST /tables/:id/qr/rotate
      const rotateRes = await request(app)
        .post(`/tables/${tableId}/qr/rotate`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin');
      expect(rotateRes.status).toBe(404);
      expect(rotateRes.body.error.code).toBe('TABLE_NOT_FOUND');

      // 404 en POST /sessions/open (incluso con el qrKey viejo)
      const openRes = await request(app)
        .post('/sessions/open')
        .send({ tenantId, tableId, qrKey: oldQrKey });
      expect(openRes.status).toBe(404);
      expect(openRes.body.error.code).toBe('TABLE_NOT_FOUND');

      // Libera su label para volver a crearse
      const recreated = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa Temporal' });
      expect(recreated.status).toBe(201);
      expect(recreated.body.label).toBe('Mesa Temporal');
      expect(recreated.body.tableId).not.toBe(tableId);
    });
  });

  describe('Roles y permisos', () => {
    test('x-user-role: staff recibe 403 FORBIDDEN en mutaciones pero 200 en GET /tables', async () => {
      const app = createSeededSessionTestApp();

      const resCreateBatch = await request(app)
        .post('/tables/batch')
        .set('x-tenant-id', 'tenant-100')
        .set('x-user-role', 'staff')
        .send({ labels: ['Mesa Staff'] });
      expect(resCreateBatch.status).toBe(403);
      expect(resCreateBatch.body.error.code).toBe('FORBIDDEN');

      const resPatchBatch = await request(app)
        .patch('/tables/batch')
        .set('x-tenant-id', 'tenant-100')
        .set('x-user-role', 'staff')
        .send({ updates: [{ tableId: 'table-1', label: 'Mesa X' }] });
      expect(resPatchBatch.status).toBe(403);
      expect(resPatchBatch.body.error.code).toBe('FORBIDDEN');

      const resPatchSingle = await request(app)
        .patch('/tables/table-1')
        .set('x-tenant-id', 'tenant-100')
        .set('x-user-role', 'staff')
        .send({ label: 'Mesa X' });
      expect(resPatchSingle.status).toBe(403);
      expect(resPatchSingle.body.error.code).toBe('FORBIDDEN');

      const resDeleteBatch = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', 'tenant-100')
        .set('x-user-role', 'staff')
        .send({ tableIds: ['table-1'] });
      expect(resDeleteBatch.status).toBe(403);
      expect(resDeleteBatch.body.error.code).toBe('FORBIDDEN');

      const resGet = await request(app)
        .get('/tables')
        .set('x-tenant-id', 'tenant-100')
        .set('x-user-role', 'staff');
      expect(resGet.status).toBe(200);
    });

    test('aislamiento entre tenants: tenant B no ve ni muta mesas de tenant A (404 TABLE_NOT_FOUND / TABLES_NOT_DELETABLE)', async () => {
      const { app } = createFreshApp();

      const createdA = await request(app)
        .post('/tables')
        .set('x-tenant-id', 'tenant-A')
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa A1' });
      expect(createdA.status).toBe(201);
      const tableAId = createdA.body.tableId;

      // Tenant B puede usar el mismo label 'Mesa A1'
      const createdB = await request(app)
        .post('/tables')
        .set('x-tenant-id', 'tenant-B')
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa A1' });
      expect(createdB.status).toBe(201);

      // Tenant B no puede editar mesa de Tenant A -> 404 TABLE_NOT_FOUND
      const patchCross = await request(app)
        .patch(`/tables/${tableAId}`)
        .set('x-tenant-id', 'tenant-B')
        .set('x-user-role', 'admin')
        .send({ label: 'Hackeada' });
      expect(patchCross.status).toBe(404);
      expect(patchCross.body.error.code).toBe('TABLE_NOT_FOUND');

      // Tenant B no puede borrar mesa de Tenant A -> 409 TABLES_NOT_DELETABLE con TABLE_NOT_FOUND
      const deleteCross = await request(app)
        .post('/tables/batch/delete')
        .set('x-tenant-id', 'tenant-B')
        .set('x-user-role', 'admin')
        .send({ tableIds: [tableAId] });
      expect(deleteCross.status).toBe(409);
      expect(deleteCross.body.error.code).toBe('TABLES_NOT_DELETABLE');
      expect(deleteCross.body.error.details.failed).toEqual([
        { tableId: tableAId, code: 'TABLE_NOT_FOUND' },
      ]);
    });

    test('límite de 500 mesas vivas por tenant -> 409 TABLE_LIMIT_EXCEEDED', async () => {
      const { app } = createFreshApp();

      for (let batch = 0; batch < 10; batch++) {
        const res = await request(app)
          .post('/tables/batch')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', 'admin')
          .send({ prefix: `Lote${batch}`, count: 50, start: 1 });
        expect(res.status).toBe(201);
      }

      const overLimit = await request(app)
        .post('/tables')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .send({ label: 'Mesa 501' });
      expect(overLimit.status).toBe(409);
      expect(overLimit.body.error.code).toBe('TABLE_LIMIT_EXCEEDED');
    });
  });
});
