import request from 'supertest';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';

const secret = 'super-secret-jwt-key-oleada-0';
process.env.JWT_SECRET = secret;
process.env.INTERNAL_SHARED_SECRET = 'resto-internal-shared-secret-dev-2026';
process.env.SESSION_SERVICE_URL = 'http://localhost:4003';

afterEach(() => nock.cleanAll());

test.each(['post', 'patch'] as const)('%s zona preserva el polígono y la respuesta 422', async (method) => {
  const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'ADMIN' }, secret);
  const polygon = [[0, 0], [3, 0], [3, 3], [0, 3]];
  const body = { name: 'Salón', polygon };
  const responseBody = { error: { code: 'SPACE_OVERLAP', details: { code: 'SPACE_OVERLAP', otherSpaceId: 'z2' } } };
  const path = method === 'post' ? '/zones' : '/zones/z1';
  const upstream = nock('http://localhost:4003')[method](path, body).reply(422, responseBody);
  const response = await request(createApp())[method](`/v1${path}`).set('Authorization', `Bearer ${token}`).send(body);
  expect(upstream.isDone()).toBe(true);
  expect(response.status).toBe(422);
  expect(response.body).toEqual(responseBody);
});
