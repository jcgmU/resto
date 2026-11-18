import http from 'http';
import { AddressInfo } from 'net';
import { HttpIdentitySettingsAdapter } from '../../src/infrastructure/identity/HttpIdentitySettingsAdapter';

describe('HttpIdentitySettingsAdapter (Unit)', () => {
  let server: http.Server;
  let baseUrl: string;
  let requestCount = 0;
  let lastRequest: { url?: string; headers?: http.IncomingHttpHeaders } = {};
  let shouldFail = false;

  beforeAll((done) => {
    process.env.INTERNAL_SHARED_SECRET = 'test-internal-token-2026';
    server = http.createServer((req, res) => {
      requestCount++;
      lastRequest = { url: req.url, headers: req.headers };

      if (shouldFail || req.url?.includes('t-error')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Error' }));
        return;
      }

      if (req.url === '/internal/tenant/t-test/settings') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          operatingMode: 'waiter_only',
          estimatedPrepMinutes: 25,
        }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    requestCount = 0;
    lastRequest = {};
    shouldFail = false;
  });

  test('1. Consulta URL interna, pasa headers x-internal-token y x-tenant-id, y parsea ambos campos', async () => {
    const adapter = new HttpIdentitySettingsAdapter(baseUrl, 5000);

    const mode = await adapter.getOperatingMode('t-test');
    expect(mode).toBe('waiter_only');
    expect(lastRequest.url).toBe('/internal/tenant/t-test/settings');
    expect(lastRequest.headers?.['x-internal-token']).toBe('test-internal-token-2026');
    expect(lastRequest.headers?.['x-tenant-id']).toBe('t-test');

    const minutes = await adapter.getEstimatedPrepMinutes('t-test');
    expect(minutes).toBe(25);
  });

  test('2. Cache: 2 llamadas para el mismo tenant realizan solo 1 fetch HTTP', async () => {
    const adapter = new HttpIdentitySettingsAdapter(baseUrl, 5000);

    await adapter.getOperatingMode('t-test');
    expect(requestCount).toBe(1);

    await adapter.getEstimatedPrepMinutes('t-test');
    expect(requestCount).toBe(1); // Cached! No extra HTTP fetch

    await adapter.getOperatingMode('t-test');
    expect(requestCount).toBe(1);
  });

  test('3. Fallback availability-first a hybrid y 18m ante error del backend o timeout', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new HttpIdentitySettingsAdapter(baseUrl, 5000);

    shouldFail = true;
    const mode = await adapter.getOperatingMode('t-error');
    const minutes = await adapter.getEstimatedPrepMinutes('t-error');

    expect(mode).toBe('hybrid');
    expect(minutes).toBe(18);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[HttpIdentitySettingsAdapter] Fallo al consultar settings de Identity')
    );
    warnSpy.mockRestore();
  });
});
