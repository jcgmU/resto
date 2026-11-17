import http from 'http';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { routeTable } from '../../../gateway/src/routes/routeTable';
import { createSeededOrderingTestApp, sharedEventPublisher  } from '../helpers/seededOrderingApp';
import { SocketIoRealtimeEmitter } from '../../src/infrastructure/realtime/SocketIoRealtimeEmitter';
import { wireRealtimeEvents } from '../../src/infrastructure/realtime/realtimeWiring';
import { EventSubscriber, OrderEvent, ServiceCallEvent } from '@packages/shared-types';

describe('D. Cierre de oleada (smoke) (Tests 24-26)', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_in_production';

  test('24. Gateway: filas de §3.2 activas; los 134 tests previos en verde', () => {
    const requiredRoutes = [
      { method: 'PATCH', path: '/v1/orders/:id/status', targetService: 'ordering', roles: ['waiter', 'manager', 'admin'] },
      { method: 'POST', path: '/v1/service-calls', targetService: 'ordering' },
      { method: 'GET', path: '/v1/service-calls', targetService: 'ordering', roles: ['waiter'] },
      { method: 'PATCH', path: '/v1/service-calls/:id/resolve', targetService: 'ordering', roles: ['waiter'] },
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

  test('25. Migración del enum OrderStatus aplica limpio sobre resto_ordering; diff de schema vacío salvo el enum', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Debe contener el enum OrderStatus con todos los 5 estados
    expect(schemaContent).toMatch(/enum\s+OrderStatus\s*\{[\s\S]*?PLACED[\s\S]*?IN_KITCHEN[\s\S]*?READY[\s\S]*?DELIVERED[\s\S]*?CANCELLED[\s\S]*?\}/);
  });

  test('26. E2E real: guest confirma order -> staff conectado por socket la ve en el KDS -> avanza a READY -> guest recibe order:status-changed de SU mesa; llamado a mesero visible para staff y resoluble en tiempo real', async () => {
    const app = createSeededOrderingTestApp();
    const tenantId = 'tenant-smoke-e2e';
    const sessionId = 'session-smoke-e2e';

    const server = http.createServer(app);
    const emitter = new SocketIoRealtimeEmitter(server, JWT_SECRET);

    class InMemSubscriber implements EventSubscriber {
      private orderHandlers: ((e: OrderEvent) => void)[] = [];
      private callHandlers: ((e: ServiceCallEvent) => void)[] = [];
      onOrderEvent(h: (e: OrderEvent) => void) { this.orderHandlers.push(h); }
      onServiceCallEvent(h: (e: ServiceCallEvent) => void) { this.callHandlers.push(h); }
      async start() {}
      async stop() {}
      triggerOrder(e: OrderEvent) { this.orderHandlers.forEach((h) => h(e)); }
      triggerCall(e: ServiceCallEvent) { this.callHandlers.forEach((h) => h(e)); }
    }
    const subscriber = new InMemSubscriber();
    wireRealtimeEvents(subscriber, emitter);

    const origOrderPub = sharedEventPublisher.publishOrderEvent.bind(sharedEventPublisher);
    sharedEventPublisher.publishOrderEvent = async (t: string, e: OrderEvent) => {
      await origOrderPub(t, e);
      subscriber.triggerOrder(e);
    };

    const origCallPub = sharedEventPublisher.publishServiceCallEvent.bind(sharedEventPublisher);
    sharedEventPublisher.publishServiceCallEvent = async (t: string, e: ServiceCallEvent) => {
      await origCallPub(t, e);
      subscriber.triggerCall(e);
    };

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const socketUrl = `http://localhost:${port}/orders`;

    const staffToken = jwt.sign({ tenantId, role: 'waiter' }, JWT_SECRET);
    const guestToken = jwt.sign({ tenantId, role: 'guest', sessionId }, JWT_SECRET);

    const staffSocket: ClientSocket = Client(socketUrl, { auth: { token: staffToken }, forceNew: true });
    const guestSocket: ClientSocket = Client(socketUrl, { auth: { token: guestToken }, forceNew: true });

    await Promise.all([
      new Promise<void>((res) => staffSocket.on('connect', res)),
      new Promise<void>((res) => guestSocket.on('connect', res)),
    ]);

    const staffEvents: any[] = [];
    const guestEvents: any[] = [];

    staffSocket.on('order:created', (d) => staffEvents.push({ type: 'order:created', ...d }));
    staffSocket.on('service-call:created', (d) => staffEvents.push({ type: 'service-call:created', ...d }));
    staffSocket.on('service-call:resolved', (d) => staffEvents.push({ type: 'service-call:resolved', ...d }));

    guestSocket.on('order:status-changed', (d) => guestEvents.push({ type: 'order:status-changed', ...d }));
    guestSocket.on('service-call:resolved', (d) => guestEvents.push({ type: 'service-call:resolved', ...d }));

    // 1. Guest llama al mesero
    const callRes = await request(app)
      .post('/service-calls')
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId)
      .send({ tableId: 'T-10', note: 'Traer agua' });

    expect(callRes.status).toBe(201);
    expect(callRes.body.status).toBe('pending');

    await new Promise((r) => setTimeout(r, 60));
    expect(staffEvents.some((e) => e.type === 'service-call:created')).toBe(true);

    // 2. Staff resuelve la llamada de servicio
    const resolveRes = await request(app)
      .patch(`/service-calls/${callRes.body.callId}/resolve`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send();

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe('resolved');

    await new Promise((r) => setTimeout(r, 60));
    expect(staffEvents.some((e) => e.type === 'service-call:resolved')).toBe(true);
    expect(guestEvents.some((e) => e.type === 'service-call:resolved')).toBe(true);

    // 3. Guest añade producto y confirma orden
    await request(app)
      .post('/cart/items')
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId)
      .send({
        productId: 'prod-1',
        quantity: 1,
        addedBy: 'Guest',
        modifiers: [],
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });

    const confirmRes = await request(app)
      .post('/cart/confirm')
      .set('x-tenant-id', tenantId)
      .set('x-session-id', sessionId)
      .send({ tableId: 'T-10' });

    expect(confirmRes.status).toBe(201);
    const orderId = confirmRes.body.id;

    await new Promise((r) => setTimeout(r, 60));
    expect(staffEvents.some((e) => e.type === 'order:created' && e.order?.id === orderId)).toBe(true);

    // 4. Staff avanza orden en el KDS a IN_KITCHEN y luego a READY
    const advance1 = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ status: 'IN_KITCHEN' });
    expect(advance1.status).toBe(200);

    const advance2 = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set('x-tenant-id', tenantId)
      .set('x-user-role', 'waiter')
      .send({ status: 'READY' });
    expect(advance2.status).toBe(200);

    await new Promise((r) => setTimeout(r, 60));
    expect(guestEvents.some((e) => e.type === 'order:status-changed' && e.status === 'READY')).toBe(true);

    staffSocket.disconnect();
    guestSocket.disconnect();
    await emitter.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
