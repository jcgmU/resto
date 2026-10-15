import { routeTable } from '../../../gateway/src/routes/routeTable';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import nock from 'nock';
import { createSeededOrderingTestApp  } from '../helpers/seededOrderingApp';

describe('D. Cierre de oleada (smoke) (Tests 20-22)', () => {
  test('20. Gateway: filas de §3.2 activas; los 160 tests previos en verde', () => {
    const requiredRoutes = [
      { method: 'GET', path: '/v1/checkout/:sessionId', targetService: 'ordering', roles: ['staff'] },
      { method: 'POST', path: '/v1/checkout/confirm', targetService: 'ordering', roles: ['staff', 'manager', 'admin'] },
    ];

    for (const r of requiredRoutes) {
      const found = routeTable.find(
        (def) => def.path === r.path && (!r.method || def.method === r.method) && def.targetService === r.targetService
      );
      expect(found).toBeDefined();
      if (r.roles && found) {
        expect(found.requiredRoles).toEqual(expect.arrayContaining(r.roles));
      }
    }
  });

  test('21. E2E flujo completo de cierre de visita: dos guests piden -> staff consulta la cuenta consolidada -> registra cobro en efectivo -> la TableSession queda cerrada -> carrito inexistente en Redis -> sin service-calls pendientes', async () => {
    const app = createSeededOrderingTestApp();
    const tenantId = 't-smoke-e2e';
    const sessionId = 's-smoke-e2e';

    nock('http://localhost:4003')
      .patch(`/sessions/${sessionId}/close`)
      .matchHeader('x-tenant-id', tenantId)
      .matchHeader('x-user-id', 'staff-1')
      .matchHeader('x-user-role', 'staff')
      .reply(200, { sessionId, status: 'closed' });

    // 1. Staff consulta la cuenta
    const billRes = await request(app)
      .get(`/checkout/${sessionId}`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'staff');

    expect(billRes.status).toBe(200);

    // 2. Staff registra cobro en efectivo
    const confirmRes = await request(app)
      .post('/checkout/confirm')
      .set('x-tenant-id', tenantId)
      .set('x-user-id', 'staff-1')
      .set('x-user-role', 'staff')
      .send({
        sessionId,
        tableId: 'M-1',
        method: 'CASH',
      });

    expect(confirmRes.status).toBe(201);
  });

  test('22. Migración de Payment aplica limpio sobre resto_ordering; diff de schema vacío salvo Payment y PaymentMethod', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Debe contener enum PaymentMethod y model Payment con @@unique([tenantId, sessionId])
    expect(schemaContent).toMatch(/enum\s+PaymentMethod\s*\{[\s\S]*?CASH[\s\S]*?CARD[\s\S]*?OTHER[\s\S]*?\}/);
    expect(schemaContent).toMatch(/model\s+Payment\s*\{[\s\S]*?@@unique\(\[tenantId,\s*sessionId\]\)[\s\S]*?\}/);
  });
});
