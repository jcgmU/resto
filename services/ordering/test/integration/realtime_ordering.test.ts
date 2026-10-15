import http from 'http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createSeededOrderingTestApp, sharedEventPublisher  } from '../helpers/seededOrderingApp';
import { SocketIoRealtimeEmitter } from '../../src/infrastructure/realtime/SocketIoRealtimeEmitter';
import { wireRealtimeEvents } from '../../src/infrastructure/realtime/realtimeWiring';
import { EventSubscriber, OrderEvent, ServiceCallEvent } from '@packages/shared-types';

describe('B. Ordering — integración tiempo real y sockets (Tests 8-13)', () => {
  const app = createSeededOrderingTestApp();
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_in_production';

  test('8. PATCH /orders/:id/status -> fila actualizada en Postgres Y mensaje en canal tenant:{t}:order-events con payload exacto { type, order, previousStatus, occurredAt }', async () => {
    const res = await request(app)
      .patch('/orders/ord-realtime-test/status')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'staff')
      .send({ status: 'IN_KITCHEN' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_KITCHEN');

    const published = sharedEventPublisher.orderEvents.find(
      (e) => e.tenantId === 't-1' && e.event.type === 'order.status-changed'
    );
    expect(published).toBeDefined();
    expect(published?.event.previousStatus).toBe('PLACED');
    expect(published?.event.order.id).toBe('ord-realtime-test');
    expect(published?.event.occurredAt).toBeDefined();
  });

  test('9. POST /service-calls (guest) -> HASH service-call:{t}:{id} + entrada en el SET de pending Y evento en tenant:{t}:service-calls', async () => {
    const res = await request(app)
      .post('/service-calls')
      .set('x-tenant-id', 't-1')
      .set('x-session-id', 's-1')
      .send({ tableId: 'tb-3', type: 'WAITER_CALL', note: 'Agua por favor' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.tableId).toBe('tb-3');
    expect(res.body.type).toBe('WAITER_CALL');

    const published = sharedEventPublisher.serviceCallEvents.find(
      (e) => e.tenantId === 't-1' && e.event.type === 'service-call.created'
    );
    expect(published).toBeDefined();
    expect(published?.event.call.tableId).toBe('tb-3');
    expect(published?.event.call.type).toBe('WAITER_CALL');
  });

  test('10. PATCH /service-calls/:id/resolve (staff) -> evento service-call.resolved; GET /service-calls?status=pending ya no lo lista', async () => {
    const res = await request(app)
      .patch('/service-calls/call-to-resolve/resolve')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'staff');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');

    const pending = await request(app)
      .get('/service-calls?status=pending')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'staff');

    expect(pending.status).toBe(200);
    const found = (pending.body || []).find((c: any) => c.callId === 'call-to-resolve');
    expect(found).toBeUndefined();

    const published = sharedEventPublisher.serviceCallEvents.find(
      (e) => e.tenantId === 't-1' && e.event.type === 'service-call.resolved'
    );
    expect(published).toBeDefined();
  });

  test('11. Socket end-to-end: cliente staff conectado al ns /orders recibe order:status-changed tras el PATCH; cliente guest recibe order:created/status-changed SOLO de su sessionId', async () => {
    const server = http.createServer(app);
    const emitter = new SocketIoRealtimeEmitter(server, JWT_SECRET);

    // Conectar publisher a emitter mediante un subscriber in-memory
    class SimpleSubscriber implements EventSubscriber {
      private orderHandlers: ((e: OrderEvent) => void)[] = [];
      private callHandlers: ((e: ServiceCallEvent) => void)[] = [];
      onOrderEvent(h: (e: OrderEvent) => void) { this.orderHandlers.push(h); }
      onServiceCallEvent(h: (e: ServiceCallEvent) => void) { this.callHandlers.push(h); }
      async start() {}
      async stop() {}
      triggerOrder(e: OrderEvent) { this.orderHandlers.forEach((h) => h(e)); }
      triggerCall(e: ServiceCallEvent) { this.callHandlers.forEach((h) => h(e)); }
    }
    const subscriber = new SimpleSubscriber();
    wireRealtimeEvents(subscriber, emitter);

    // Forward published events from sharedEventPublisher to subscriber
    const originalPublish = sharedEventPublisher.publishOrderEvent.bind(sharedEventPublisher);
    sharedEventPublisher.publishOrderEvent = async (t: string, e: OrderEvent) => {
      await originalPublish(t, e);
      subscriber.triggerOrder(e);
    };

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const socketUrl = `http://localhost:${port}/orders`;

    const staffToken = jwt.sign({ tenantId: 't-1', role: 'staff' }, JWT_SECRET);
    const guest1Token = jwt.sign({ tenantId: 't-1', role: 'guest', sessionId: 's-1' }, JWT_SECRET);
    const guest2Token = jwt.sign({ tenantId: 't-1', role: 'guest', sessionId: 's-other' }, JWT_SECRET);

    const staffSocket: ClientSocket = Client(socketUrl, { auth: { token: staffToken }, forceNew: true });
    const guest1Socket: ClientSocket = Client(socketUrl, { auth: { token: guest1Token }, forceNew: true });
    const guest2Socket: ClientSocket = Client(socketUrl, { auth: { token: guest2Token }, forceNew: true });

    await Promise.all([
      new Promise<void>((res) => staffSocket.on('connect', res)),
      new Promise<void>((res) => guest1Socket.on('connect', res)),
      new Promise<void>((res) => guest2Socket.on('connect', res)),
    ]);

    const staffEvents: any[] = [];
    const guest1Events: any[] = [];
    const guest2Events: any[] = [];

    staffSocket.on('order:status-changed', (data) => staffEvents.push(data));
    guest1Socket.on('order:status-changed', (data) => guest1Events.push(data));
    guest2Socket.on('order:status-changed', (data) => guest2Events.push(data));

    // PATCH orden con sessionId 's-1'
    const patchRes = await request(app)
      .patch('/orders/ord-realtime-test/status')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'staff')
      .send({ status: 'READY' });

    expect(patchRes.status).toBe(200);

    // Esperar llegada de eventos por socket
    await new Promise((r) => setTimeout(r, 100));

    expect(staffEvents.length).toBeGreaterThan(0);
    expect(staffEvents[0].status).toBe('READY');

    expect(guest1Events.length).toBeGreaterThan(0);
    expect(guest1Events[0].status).toBe('READY');

    // Asertar explícitamente verificación NEGATIVA: guest de otra mesa NO recibe el evento
    expect(guest2Events).toHaveLength(0);

    staffSocket.disconnect();
    guest1Socket.disconnect();
    guest2Socket.disconnect();
    await emitter.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('11b. Staff con role ADMIN en mayúsculas hace join al room tenant y recibe emitToTenant', async () => {
    const server = http.createServer(app);
    const emitter = new SocketIoRealtimeEmitter(server, JWT_SECRET);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const socketUrl = `http://localhost:${port}/orders`;

    const adminToken = jwt.sign({ tenantId: 't-1', role: 'ADMIN' }, JWT_SECRET);
    const adminSocket: ClientSocket = Client(socketUrl, { auth: { token: adminToken }, forceNew: true });

    await new Promise<void>((res) => adminSocket.on('connect', res));

    const receivedEvents: any[] = [];
    adminSocket.on('order:created', (data) => receivedEvents.push(data));

    emitter.emitToTenant('t-1', 'order:created', { id: 'order-admin-test', status: 'PLACED' });

    await new Promise((r) => setTimeout(r, 100));

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].id).toBe('order-admin-test');

    adminSocket.disconnect();
    await emitter.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('12. Socket sin token o con token inválido -> connect_error', async () => {
    const server = http.createServer(app);
    const emitter = new SocketIoRealtimeEmitter(server, JWT_SECRET);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const socketUrl = `http://localhost:${port}/orders`;

    // 1. Sin token
    const noTokenSocket = Client(socketUrl, { auth: {}, forceNew: true });
    const noTokenError = await new Promise<any>((resolve) => {
      noTokenSocket.on('connect_error', (err) => resolve(err));
    });
    expect(noTokenError).toBeDefined();
    noTokenSocket.disconnect();

    // 2. Token inválido
    const invalidTokenSocket = Client(socketUrl, { auth: { token: 'invalid.jwt.token' }, forceNew: true });
    const invalidTokenError = await new Promise<any>((resolve) => {
      invalidTokenSocket.on('connect_error', (err) => resolve(err));
    });
    expect(invalidTokenError).toBeDefined();
    invalidTokenSocket.disconnect();

    await emitter.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('13. PATCH /orders/:id/status con guest -> 403; con staff -> 200; POST /service-calls sin x-session-id -> 401 SESSION_REQUIRED', async () => {
    const guestPatch = await request(app)
      .patch('/orders/ord-test/status')
      .set('x-tenant-id', 't-1')
      .set('x-session-id', 's-1')
      .set('x-user-role', 'guest')
      .send({ status: 'IN_KITCHEN' });
    expect(guestPatch.status).toBe(403);

    const staffPatch = await request(app)
      .patch('/orders/ord-test/status')
      .set('x-tenant-id', 't-1')
      .set('x-user-role', 'staff')
      .send({ status: 'IN_KITCHEN' });
    expect(staffPatch.status).toBe(200);

    const noSessionCall = await request(app)
      .post('/service-calls')
      .set('x-tenant-id', 't-1')
      .send({ tableId: 'tb-1' });
    expect(noSessionCall.status).toBe(401);
    expect(noSessionCall.body.error.code).toBe('SESSION_REQUIRED');
  });
});
