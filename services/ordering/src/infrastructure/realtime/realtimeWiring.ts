import { EventSubscriber, RealtimeEmitter } from '@packages/shared-types';

export function wireRealtimeEvents(subscriber: EventSubscriber, emitter: RealtimeEmitter): void {
  subscriber.onOrderEvent((event) => {
    if (event.type === 'order.created') {
      const payload = {
        order: event.order,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.order.tenantId, 'order:created', payload);
      emitter.emitToSession(event.order.sessionId, 'order:created', payload);
    } else if (event.type === 'order.status-changed') {
      const payload = {
        orderId: event.order.id,
        status: event.order.status,
        previousStatus: event.previousStatus || '',
        order: event.order,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.order.tenantId, 'order:status-changed', payload);
      emitter.emitToSession(event.order.sessionId, 'order:status-changed', payload);
    } else if ((event as any).type === 'order.delay-updated') {
      const e = event as any;
      const payload = {
        orderId: e.order.id,
        delayMinutes: e.delayMinutes,
        order: e.order,
        occurredAt: e.occurredAt,
      };
      emitter.emitToTenant(e.order.tenantId, 'order:delay-updated', payload);
      emitter.emitToSession(e.order.sessionId, 'order:delay-updated', payload);
    } else if ((event as any).type === 'session.checkout-completed') {
      const e = event as any;
      const payload = {
        sessionId: e.sessionId,
        tableId: e.tableId,
        payment: e.payment,
        occurredAt: e.occurredAt,
      };
      emitter.emitToTenant(e.payment.tenantId, 'session:checkout-completed', payload);
    }
  });

  subscriber.onServiceCallEvent((event) => {
    if (event.type === 'service-call.created') {
      const payload = {
        call: event.call,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.call.tenantId, 'service-call:created', payload);
    } else if (event.type === 'service-call.resolved') {
      const payload = {
        call: event.call,
        occurredAt: event.occurredAt,
      };
      emitter.emitToTenant(event.call.tenantId, 'service-call:resolved', payload);
      emitter.emitToSession(event.call.sessionId, 'service-call:resolved', payload);
    }
  });

  if (subscriber.onTableStatusChanged) {
    subscriber.onTableStatusChanged((event) => {
      emitter.emitToTenant(event.tenantId, 'table:status-changed', event);
      if (event.sessionId) {
        emitter.emitToSession(event.sessionId, 'table:status-changed', event);
      }
    });
  }
}
