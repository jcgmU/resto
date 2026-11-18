import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createOrderingApp, closeDefaultAppConnections } from '../../src/app';
import { PrismaSalesReportRepository } from '../../src/infrastructure/persistence/PrismaSalesReportRepository';

const tenant = `sales-contract-${process.pid}-${Date.now()}`;
const tenantOther = `${tenant}-other`;
const tenantBoundary = `${tenant}-boundary`;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.ORDERING_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/resto_ordering_test?schema=public' } } });
const app = createOrderingApp({ prisma });

describe('reporte de ventas por tenant', () => {
  beforeAll(async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    await prisma.payment.createMany({ data: [
      { tenantId: tenant, sessionId: `${tenant}-a`, tableId: 't1', amount: '0.10', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: now },
      { tenantId: tenant, sessionId: `${tenant}-b`, tableId: 't2', amount: '0.20', method: 'CARD', ordersCount: 1, recordedBy: 'test', createdAt: now },
      { tenantId: tenant, sessionId: `${tenant}-past`, tableId: 't3', amount: '99.00', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: yesterday },
      { tenantId: tenantOther, sessionId: `${tenant}-other`, tableId: 't1', amount: '40.00', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: now },
    ] });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { tenantId: { in: [tenant, tenantOther, tenantBoundary] } } });
    await prisma.$disconnect();
    await closeDefaultAppConnections();
  });

  it('responde al administrador con sumas exactas y aislamiento del tenant', async () => {
    const res = await request(app).get('/reports/sales/today?tz=UTC').set('x-tenant-id', tenant).set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: '0.30', tickets: 2, averageTicket: '0.15' });
    const other = await request(app).get('/reports/sales/today?tz=UTC').set('x-tenant-id', tenantOther).set('x-user-role', 'MANAGER');
    expect(other.status).toBe(200);
    expect(other.body).toEqual({ total: '40.00', tickets: 1, averageTicket: '40.00' });
  });

  it('devuelve ceros para día vacío', async () => {
    const res = await request(app).get('/reports/sales/today?tz=UTC').set('x-tenant-id', `${tenant}-empty`).set('x-user-role', 'MANAGER');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: '0.00', tickets: 0, averageTicket: '0.00' });
  });

  it('incluye el inicio y excluye el final del rango', async () => {
    const from = new Date('2026-11-17T05:00:00.000Z');
    const to = new Date('2026-11-18T05:00:00.000Z');
    await prisma.payment.createMany({ data: [
      { tenantId: tenantBoundary, sessionId: `${tenant}-before`, tableId: 't', amount: '10.00', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: new Date(from.getTime() - 1) },
      { tenantId: tenantBoundary, sessionId: `${tenant}-start`, tableId: 't', amount: '0.01', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: from },
      { tenantId: tenantBoundary, sessionId: `${tenant}-end`, tableId: 't', amount: '10.00', method: 'CASH', ordersCount: 1, recordedBy: 'test', createdAt: to },
    ] });
    expect(await new PrismaSalesReportRepository(prisma).sumPaymentsBetween(tenantBoundary, from, to)).toEqual({ total: '0.01', tickets: 1 });
  });

  it('rechaza zona inválida, personal sin permiso y solicitud sin identidad', async () => {
    expect((await request(app).get('/reports/sales/today?tz=No%2FExiste').set('x-tenant-id', tenant).set('x-user-role', 'ADMIN')).status).toBe(400);
    expect((await request(app).get('/reports/sales/today?tz=UTC').set('x-tenant-id', tenant).set('x-user-role', 'WAITER')).status).toBe(403);
    expect((await request(app).get('/reports/sales/today?tz=UTC')).status).toBe(401);
  });
});
