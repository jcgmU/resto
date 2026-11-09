import request from 'supertest';
import { createOrderingApp } from '../../src/app';
import {
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryServiceCallRepository,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { CatalogValidationPort, EventPublisher, SessionServicePort } from '@packages/shared-types';

describe('U4: Paid Session, Concurrency & Cancellation Integration', () => {
  let cartRepo: InMemoryCartRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let serviceCallRepo: InMemoryServiceCallRepository;
  let eventPublisher: EventPublisher;
  let catalogValidation: CatalogValidationPort;
  let sessionService: SessionServicePort & {
    getSession?: (tenantId: string, sessionId: string) => Promise<any>;
  };
  let app: any;

  const tenantId = 't-u4-test';
  const sessionId = 's-u4-session-1';
  const tableId = 'tab-u4-1';

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    serviceCallRepo = new InMemoryServiceCallRepository();
    eventPublisher = {
      publishOrderEvent: jest.fn().mockResolvedValue(undefined),
      publishServiceCallEvent: jest.fn().mockResolvedValue(undefined),
      publishCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
    };
    catalogValidation = {
      getOrderableProducts: jest.fn().mockResolvedValue([
        {
          productId: 'p-burger',
          name: 'Burger Test',
          price: 15,
          isAvailable: true,
          modifierGroups: [],
        },
      ]),
    };
    sessionService = {
      closeSession: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn().mockResolvedValue({
        sessionId,
        tenantId,
        tableId,
        status: 'active',
      }),
    };

    app = createOrderingApp({
      cartRepo,
      orderRepo,
      paymentRepo,
      serviceCallRepo,
      catalogValidation,
      eventPublisher,
      sessionService,
    });
  });

  describe('1. Cart mutations & order confirmation when session is paid or not active', () => {
    it('rejects POST /cart/items with 409 SESSION_NOT_ACTIVE if payment already exists', async () => {
      // Registrar un pago previo para la sesión
      await paymentRepo.save(tenantId, {
        id: 'pay-1',
        tenantId,
        sessionId,
        tableId,
        amount: 30,
        method: 'CASH',
        ordersCount: 1,
        recordedBy: 'staff-1',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({
          productId: 'p-burger',
          quantity: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SESSION_NOT_ACTIVE');
    });

    it('rejects PATCH /cart/items/:id with 409 SESSION_NOT_ACTIVE if payment already exists', async () => {
      await paymentRepo.save(tenantId, {
        id: 'pay-2',
        tenantId,
        sessionId,
        tableId,
        amount: 30,
        method: 'CASH',
        ordersCount: 1,
        recordedBy: 'staff-1',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .patch('/cart/items/ci-item-1')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({ quantity: 2 });

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SESSION_NOT_ACTIVE');
    });

    it('rejects DELETE /cart/items/:id with 409 SESSION_NOT_ACTIVE if payment already exists', async () => {
      await paymentRepo.save(tenantId, {
        id: 'pay-3',
        tenantId,
        sessionId,
        tableId,
        amount: 30,
        method: 'CASH',
        ordersCount: 1,
        recordedBy: 'staff-1',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .delete('/cart/items/ci-item-1')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId);

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SESSION_NOT_ACTIVE');
    });

    it('rejects POST /orders/confirm (and /cart/confirm) with 409 SESSION_NOT_ACTIVE if payment already exists', async () => {
      await cartRepo.upsertItem(
        tenantId,
        sessionId,
        {
          cartItemId: 'ci-1',
          productId: 'p-burger',
          productName: 'Burger',
          unitPrice: 15,
          modifiers: [],
          quantity: 1,
          lineTotal: 15,
          addedAt: new Date().toISOString(),
        },
        7200
      );

      await paymentRepo.save(tenantId, {
        id: 'pay-4',
        tenantId,
        sessionId,
        tableId,
        amount: 15,
        method: 'CASH',
        ordersCount: 1,
        recordedBy: 'staff-1',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/orders/confirm')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({ tableId });

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SESSION_NOT_ACTIVE');
      expect(await orderRepo.listBySession(tenantId, sessionId)).toHaveLength(0);
    });

    it('rejects confirm if session is closed according to sessionService', async () => {
      sessionService.getSession = jest.fn().mockResolvedValue({
        sessionId,
        tenantId,
        tableId,
        status: 'closed',
      });

      await cartRepo.upsertItem(
        tenantId,
        sessionId,
        {
          cartItemId: 'ci-1',
          productId: 'p-burger',
          productName: 'Burger',
          unitPrice: 15,
          modifiers: [],
          quantity: 1,
          lineTotal: 15,
          addedAt: new Date().toISOString(),
        },
        7200
      );

      const res = await request(app)
        .post('/cart/confirm')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({ tableId });

      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SESSION_NOT_ACTIVE');
    });

    it('rejects confirm with 400 VALIDATION_ERROR on table or tenant mismatch', async () => {
      sessionService.getSession = jest.fn().mockResolvedValue({
        sessionId,
        tenantId,
        tableId: 'table-other',
        status: 'active',
      });

      await cartRepo.upsertItem(
        tenantId,
        sessionId,
        {
          cartItemId: 'ci-1',
          productId: 'p-burger',
          productName: 'Burger',
          unitPrice: 15,
          modifiers: [],
          quantity: 1,
          lineTotal: 15,
          addedAt: new Date().toISOString(),
        },
        7200
      );

      const res = await request(app)
        .post('/cart/confirm')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({ tableId: 'table-mismatch' });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns 502 SESSION_UNREACHABLE if session service fails network transport', async () => {
      sessionService.getSession = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await cartRepo.upsertItem(
        tenantId,
        sessionId,
        {
          cartItemId: 'ci-1',
          productId: 'p-burger',
          productName: 'Burger',
          unitPrice: 15,
          modifiers: [],
          quantity: 1,
          lineTotal: 15,
          addedAt: new Date().toISOString(),
        },
        7200
      );

      const res = await request(app)
        .post('/cart/confirm')
        .set('x-tenant-id', tenantId)
        .set('x-session-id', sessionId)
        .send({ tableId });

      expect(res.status).toBe(502);
      expect(res.body.error?.code).toBe('SESSION_UNREACHABLE');
    });
  });

  describe('2. Order Cancellation alignment across /cancel and /status', () => {
    let orderId: string;

    beforeEach(async () => {
      const saved = await orderRepo.save(tenantId, {
        id: 'ord-test-cancel-1',
        tenantId,
        sessionId,
        tableId,
        status: 'PLACED',
        total: 15,
        items: [],
        createdAt: new Date().toISOString(),
      });
      orderId = saved.id;
    });

    it('STAFF updating status to CANCELLED via PATCH /orders/:id/status returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .set('x-user-id', 'staff-1')
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('STAFF calling POST /orders/:id/cancel returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/orders/${orderId}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .set('x-user-id', 'staff-1')
        .send();

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('STAFF can update status to IN_KITCHEN or READY', async () => {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'staff')
        .set('x-user-id', 'staff-1')
        .send({ status: 'IN_KITCHEN' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_KITCHEN');
    });

    it('ADMIN or MANAGER can cancel order via PATCH /orders/:id/status', async () => {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'manager')
        .set('x-user-id', 'mgr-1')
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('ADMIN or MANAGER can cancel order via POST /orders/:id/cancel', async () => {
      const res = await request(app)
        .post(`/orders/${orderId}/cancel`)
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'admin')
        .set('x-user-id', 'admin-1')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });
});
