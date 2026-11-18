import request from 'supertest';
import jwt from 'jsonwebtoken';
import nock from 'nock';
import { createApp } from '../src/app';
import { config } from '../src/config';

describe('Informes de ventas a través del gateway', () => {
  afterEach(() => nock.cleanAll());

  test.each(['ADMIN', 'MANAGER'])('permite %s y transmite zona e identidad del token', async (role) => {
    const token = jwt.sign({ userId: 'user-1', tenantId: 'tenant-1', role }, config.jwtSecret);
    const upstream = nock(config.services.ordering)
      .get('/reports/sales/today')
      .query({ tz: 'America/Bogota' })
      .matchHeader('x-tenant-id', 'tenant-1')
      .matchHeader('x-user-id', 'user-1')
      .matchHeader('x-user-role', role)
      .reply(200, { total: '24.00', tickets: 2, averageTicket: '12.00' });

    const response = await request(createApp()).get('/v1/reports/sales/today')
      .query({ tz: 'America/Bogota' })
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', 'tenant-ajeno');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: '24.00', tickets: 2, averageTicket: '12.00' });
    expect(upstream.isDone()).toBe(true);
  });

  test.each(['WAITER', 'CASHIER', 'MONITOR', 'GUEST'])('deniega %s antes del proxy', async (role) => {
    const token = jwt.sign({ userId: 'user-1', tenantId: 'tenant-1', role }, config.jwtSecret);
    const response = await request(createApp()).get('/v1/reports/sales/today')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  test('deniega acceso sin token', async () => {
    const response = await request(createApp()).get('/v1/reports/sales/today');
    expect(response.status).toBe(401);
  });
});
