import http from 'http';
import { HttpSessionServiceAdapter } from '../../src/infrastructure/session/HttpSessionServiceAdapter';
import { SessionUnreachableError } from '../../src/domain/errors';

describe('HttpSessionServiceAdapter - Eliminación de bypass hardcodeado s-smoke-e2e (U4-R6)', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      if (req.url?.includes('sessions/s-smoke-e2e/close')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
        return;
      }
      if (req.url?.includes('sessions/s-smoke-e2e')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: 'other', status: 'active' }));
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as import('net').AddressInfo;
      serverUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.closeAllConnections?.();
    server.close(done);
  });

  test('getSession for s-smoke-e2e performs real HTTP request and returns null on 404 instead of synthetic active session', async () => {
    const adapter = new HttpSessionServiceAdapter(serverUrl, 1000);
    const result = await adapter.getSession('t-smoke-e2e', 's-smoke-e2e');
    // If the hardcoded bypass exists, it returns { sessionId: 's-smoke-e2e', status: 'active', tableId: 'M-1' } without making HTTP request
    // Without the bypass, it must return null because server returned 404
    expect(result).toBeNull();
  });

  test('closeSession for s-smoke-e2e performs real HTTP request and throws when server fails instead of silent bypass', async () => {
    const adapter = new HttpSessionServiceAdapter(serverUrl, 1000);
    // If the hardcoded bypass exists, closeSession returns immediately without error
    // Without the bypass, server responds with 500, so closeSession must reject
    await expect(
      adapter.closeSession('t-smoke-e2e', 's-smoke-e2e', { userId: 'staff-1', role: 'staff' })
    ).rejects.toThrow();
  });
});
