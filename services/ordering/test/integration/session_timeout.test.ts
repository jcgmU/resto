import http from 'http';
import request from 'supertest';
import { HttpSessionServiceAdapter, SESSION_REQUEST_TIMEOUT_MS } from '../../src/infrastructure/session/HttpSessionServiceAdapter';
import { GraphqlCatalogValidationAdapter, CATALOG_REQUEST_TIMEOUT_MS } from '../../src/infrastructure/catalog/GraphqlCatalogValidationAdapter';
import {
  InMemoryCartRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryEventPublisher,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryServiceCallRepository,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { createOrderingApp } from '../../src/app';
import { CatalogUnreachableError, SessionUnreachableError } from '../../src/domain/errors';

describe('Session and Catalog Request Timeouts (Integration - X2)', () => {
  let server: http.Server;
  let hangingUrl: string;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      if (req.url?.includes('partial')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"sessionId":');
        // Never ends response stream
        return;
      }
      // Accept connection and never respond (hangs)
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as import('net').AddressInfo;
      hangingUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.closeAllConnections?.();
    server.close(done);
  });

  test('constants are exported correctly with 5000ms', () => {
    expect(SESSION_REQUEST_TIMEOUT_MS).toBe(5000);
    expect(CATALOG_REQUEST_TIMEOUT_MS).toBe(5000);
  });

  test('HttpSessionServiceAdapter.getSession and closeSession timeout and throw SessionUnreachableError (SESSION_UNREACHABLE)', async () => {
    const adapter = new HttpSessionServiceAdapter(hangingUrl, 150);

    const startGet = Date.now();
    await expect(adapter.getSession('t-1', 's-1')).rejects.toThrow(SessionUnreachableError);
    const durationGet = Date.now() - startGet;
    expect(durationGet).toBeLessThan(1000);

    const startPartial = Date.now();
    await expect(adapter.getSession('t-1', 's-partial')).rejects.toThrow(SessionUnreachableError);
    const durationPartial = Date.now() - startPartial;
    expect(durationPartial).toBeLessThan(1000);

    const startClose = Date.now();
    await expect(adapter.closeSession('t-1', 's-1', { userId: 'u-1', role: 'staff' })).rejects.toThrow(
      SessionUnreachableError
    );
    const durationClose = Date.now() - startClose;
    expect(durationClose).toBeLessThan(1000);
  });

  test('POST /orders/confirm with hanging session service returns 502 SESSION_UNREACHABLE within limit', async () => {
    const adapter = new HttpSessionServiceAdapter(hangingUrl, 150);
    const app = createOrderingApp({
      cartRepo: new InMemoryCartRepository(),
      orderRepo: new InMemoryOrderRepository(),
      catalogValidation: new InMemoryCatalogValidationAdapter(),
      serviceCallRepo: new InMemoryServiceCallRepository(),
      eventPublisher: new InMemoryEventPublisher(),
      paymentRepo: new InMemoryPaymentRepository(),
      sessionService: adapter,
    });

    const start = Date.now();
    const res = await request(app)
      .post('/orders/confirm')
      .set('x-tenant-id', 't-1')
      .set('x-session-id', 's-1')
      .set('x-user-role', 'guest')
      .send({ tableId: 'T-1' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
    expect(res.status).toBe(502);
    expect(res.body.error?.code).toBe('SESSION_UNREACHABLE');
  });

  test('GraphqlCatalogValidationAdapter times out and throws CatalogUnreachableError within limit', async () => {
    const catalogAdapter = new GraphqlCatalogValidationAdapter(hangingUrl, 150);

    const start = Date.now();
    await expect(catalogAdapter.getOrderableProducts('t-1', ['prod-1'])).rejects.toThrow(
      CatalogUnreachableError
    );
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});
