import request from 'supertest';
import { createOrderingApp } from '../../src/app';
import {
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryServiceCallRepository,
  InMemoryPaymentRepository,
  InMemorySessionServiceAdapter,
  InMemoryEventPublisher,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { InMemoryTransactionCoordinator } from '../../src/infrastructure/fakes/InMemoryTransactionCoordinator';
import { OrderDTO } from '@packages/shared-types';

describe('Role Authorization Matrix for Ordering (U7 Reconciled)', () => {
  let app: any;
  let cartRepo: InMemoryCartRepository;
  let orderRepo: InMemoryOrderRepository;
  let catalogValidation: InMemoryCatalogValidationAdapter;
  let serviceCallRepo: InMemoryServiceCallRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let sessionService: InMemorySessionServiceAdapter;
  let eventPublisher: InMemoryEventPublisher;
  let txCoordinator: InMemoryTransactionCoordinator;

  const tenantId = 't-role-matrix';
  const sessionId = 's-role-matrix';
  const tableId = 'table-matrix-1';

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    orderRepo = new InMemoryOrderRepository();
    catalogValidation = new InMemoryCatalogValidationAdapter();
    serviceCallRepo = new InMemoryServiceCallRepository();
    paymentRepo = new InMemoryPaymentRepository();
    sessionService = new InMemorySessionServiceAdapter({ autoCreateActive: true });
    eventPublisher = new InMemoryEventPublisher();
    txCoordinator = new InMemoryTransactionCoordinator();

    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Burger',
        price: 10,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    app = createOrderingApp({
      cartRepo,
      orderRepo,
      catalogValidation,
      serviceCallRepo,
      paymentRepo,
      sessionService,
      eventPublisher,
      txCoordinator,
    });
  });

  describe('1. Checkout Routes Authorization', () => {
    const allowedCheckoutRoles = ['admin', 'manager', 'waiter', 'waiter', 'cashier', 'WAITER', 'CASHIER'];
    const forbiddenCheckoutRoles = ['monitor', 'MONITOR', 'guest', 'unknown'];

    for (const role of allowedCheckoutRoles) {
      it(`GET /checkout/:sessionId allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .get(`/checkout/${sessionId}`)
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .set('x-user-id', 'user-1');

        expect(res.status).not.toBe(403);
      });

      it(`POST /checkout/:sessionId/retry-invoice allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .post(`/checkout/${sessionId}/retry-invoice`)
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .set('x-user-id', 'user-1')
          .send({});

        expect(res.status).not.toBe(403);
      });
    }

    for (const role of forbiddenCheckoutRoles) {
      it(`GET /checkout/:sessionId denies role ${role} with 403 FORBIDDEN`, async () => {
        const res = await request(app)
          .get(`/checkout/${sessionId}`)
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .set('x-user-id', 'user-1');

        expect(res.status).toBe(403);
        expect(res.body.error?.code).toBe('FORBIDDEN');
      });

      it(`POST /checkout/confirm denies role ${role} with 403 FORBIDDEN`, async () => {
        const res = await request(app)
          .post('/checkout/confirm')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .set('x-user-id', 'user-1')
          .send({ sessionId, tableId, method: 'CASH' });

        expect(res.status).toBe(403);
        expect(res.body.error?.code).toBe('FORBIDDEN');
      });
    }

    describe('closePendingOrders override (exclusive to admin and manager)', () => {
      beforeEach(async () => {
        // Seed order in PLACED status
        const order: OrderDTO = {
          id: 'ord-pending-1',
          tenantId,
          sessionId,
          tableId,
          status: 'PLACED',
          total: 10,
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              productName: 'Burger',
              quantity: 1,
              unitPrice: 10,
              modifiers: [],
            },
          ],
          createdAt: new Date().toISOString(),
        };
        await orderRepo.save(tenantId, order);
      });

      it('allows admin to close pending orders on checkout', async () => {
        const res = await request(app)
          .post('/checkout/confirm')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', 'admin')
          .set('x-user-id', 'admin-1')
          .send({ sessionId, tableId, method: 'CASH', closePendingOrders: true });

        expect(res.status).toBe(201);
      });

      it('allows manager to close pending orders on checkout', async () => {
        const res = await request(app)
          .post('/checkout/confirm')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', 'manager')
          .set('x-user-id', 'manager-1')
          .send({ sessionId, tableId, method: 'CASH', closePendingOrders: true });

        expect(res.status).toBe(201);
      });

      for (const nonManagerRole of ['waiter', 'waiter', 'cashier', 'WAITER', 'CASHIER']) {
        it(`denies closePendingOrders for role ${nonManagerRole} with 403 FORBIDDEN`, async () => {
          const res = await request(app)
            .post('/checkout/confirm')
            .set('x-tenant-id', tenantId)
            .set('x-user-role', nonManagerRole)
            .set('x-user-id', 'user-1')
            .send({ sessionId, tableId, method: 'CASH', closePendingOrders: true });

          expect(res.status).toBe(403);
          expect(res.body.error?.code).toBe('FORBIDDEN');
        });
      }
    });
  });

  describe('2. Orders Routes Authorization', () => {
    beforeEach(async () => {
      const order: OrderDTO = {
        id: 'ord-status-1',
        tenantId,
        sessionId,
        tableId,
        status: 'PLACED',
        total: 10,
        items: [],
        createdAt: new Date().toISOString(),
      };
      await orderRepo.save(tenantId, order);
    });

    const statusRoles = ['admin', 'manager', 'waiter', 'waiter', 'monitor', 'WAITER', 'MONITOR'];
    for (const role of statusRoles) {
      it(`PATCH /orders/:id/status allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .patch('/orders/ord-status-1/status')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .send({ status: 'IN_KITCHEN' });

        expect(res.status).not.toBe(403);
      });

      it(`PATCH /orders/:id/delay allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .patch('/orders/ord-status-1/delay')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role)
          .send({ delayMinutes: 15 });

        expect(res.status).not.toBe(403);
      });

      it(`GET /orders allows role ${role} to list tenant orders without 403`, async () => {
        const res = await request(app)
          .get('/orders')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role);

        expect(res.status).toBe(200);
      });
    }

    it('GET /orders allows cashier to list tenant orders without 403/401', async () => {
      const res = await request(app)
        .get('/orders')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'cashier');

      expect(res.status).toBe(200);
    });

    it('PATCH /orders/:id/status denies cashier with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch('/orders/ord-status-1/status')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'cashier')
        .send({ status: 'IN_KITCHEN' });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('PATCH /orders/:id/cancel allows admin and manager', async () => {
      for (const role of ['admin', 'manager']) {
        const res = await request(app)
          .patch('/orders/ord-status-1/cancel')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role);

        expect(res.status).not.toBe(403);
      }
    });

    it('PATCH /orders/:id/cancel denies staff, waiter, cashier, monitor with 403 FORBIDDEN', async () => {
      for (const role of ['waiter', 'waiter', 'cashier', 'monitor']) {
        const res = await request(app)
          .patch('/orders/ord-status-1/cancel')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role);

        expect(res.status).toBe(403);
        expect(res.body.error?.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('3. Service Calls Authorization', () => {
    const allowedServiceCallRoles = [
      'admin',
      'manager',
      'waiter',
      'waiter',
      'monitor',
      'cashier',
      'WAITER',
      'MONITOR',
      'CASHIER',
    ];

    for (const role of allowedServiceCallRoles) {
      it(`GET /service-calls allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .get('/service-calls')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role);

        expect(res.status).toBe(200);
      });

      it(`PATCH /service-calls/:id/resolve allows role ${role} (does not return 403)`, async () => {
        const res = await request(app)
          .patch('/service-calls/call-1/resolve')
          .set('x-tenant-id', tenantId)
          .set('x-user-role', role);

        expect(res.status).not.toBe(403);
      });
    }

    it('GET /service-calls denies unprivileged/guest with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/service-calls')
        .set('x-tenant-id', tenantId)
        .set('x-user-role', 'guest');

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });
  });
});
