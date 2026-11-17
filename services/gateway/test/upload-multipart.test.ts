import http from 'http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { config } from '../src/config';

test('POST multipart llega al catálogo con tipo, delimitador y bytes intactos', async () => {
  const boundary = 'resto-upload-boundary';
  const file = Buffer.from([0, 255, 1, 128, 13, 10, 42, 0, 254]);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const valid = req.url === '/uploads' &&
        req.headers['content-type'] === `multipart/form-data; boundary=${boundary}` &&
        Buffer.concat(chunks).equals(body);
      res.writeHead(valid ? 201 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const originalTarget = config.services.catalog;
  try {
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Puerto del upstream no disponible');
    config.services.catalog = `http://127.0.0.1:${address.port}`;
    const token = jwt.sign({ userId: 'u1', tenantId: 't1', role: 'ADMIN' }, config.jwtSecret);
    const res = await request(createApp())
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ valid: true });
  } finally {
    config.services.catalog = originalTarget;
    await new Promise<void>((resolve, reject) => upstream.close((err) => err ? reject(err) : resolve()));
  }
});
