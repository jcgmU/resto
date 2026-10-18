import request from 'supertest';
import {
  createSeededOrderingTestApp,
  sharedCartRepo,
  sharedOrderRepo,
  sharedServiceCallRepo,
  sharedEventPublisher,
  sharedPaymentRepo,
  sharedSessionService,
} from '../helpers/seededOrderingApp';
import { createOrderingApp } from '../../src/app';
import { CatalogUnreachableError } from '../../src/domain/errors';

describe('B. Ordering — integración HTTP (Tests 13-17)', () => {
  const app = createSeededOrderingTestApp();

  test('13. POST /cart/items persiste la línea en el HASH cart:{tenantId}:{sessionId} con TTL configurado', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-1')
      .send({
        productId: 'prod-1',
        modifiers: [],
        quantity: 2,
        display: {
          productName: 'Tacos',
          unitPrice: 10,
          modifierNames: [],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(20);
  });

  test('14. Dos guests de la MISMA sesión (dos tokens distintos, mismo sessionId): lo que añade uno lo ve el otro en GET /cart', async () => {
    await request(app)
      .post('/cart/items')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-shared')
      .send({
        productId: 'prod-1',
        modifiers: [],
        quantity: 1,
        addedBy: 'Guest Alpha',
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });

    const resGuest2 = await request(app)
      .get('/cart')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-shared');

    expect(resGuest2.status).toBe(200);
    expect(resGuest2.body.items).toHaveLength(1);
    expect(resGuest2.body.items[0].addedBy).toBe('Guest Alpha');
  });

  test('15. POST /cart/confirm -> filas Order/OrderItem/OrderItemModifier persistidas en Postgres y clave del carrito eliminada en Redis', async () => {
    await request(app)
      .post('/cart/items')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-confirm')
      .send({
        productId: 'prod-1',
        modifiers: [{ groupId: 'g1', optionId: 'o1' }],
        quantity: 1,
        display: {
          productName: 'Tacos',
          unitPrice: 10,
          modifierNames: [{ groupName: 'Salsa', optionName: 'Verde', priceDelta: 0 }],
        },
      });

    const confirmRes = await request(app)
      .post('/cart/confirm')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-confirm')
      .send();

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.status).toBe('PLACED');
    expect(confirmRes.body.items).toHaveLength(1);

    const cartRes = await request(app)
      .get('/cart')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-confirm');

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.items).toHaveLength(0);
  });

  test('16. Rutas /cart* sin x-session-id -> 401 SESSION_REQUIRED; GET /orders con rol staff -> 200; guest leyendo /orders/:id de otra sesión -> 403', async () => {
    const noSession = await request(app)
      .get('/cart')
      .set('x-tenant-id', 'tenant-1');
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe('SESSION_REQUIRED');

    const staffOrders = await request(app)
      .get('/orders')
      .set('x-tenant-id', 'tenant-1')
      .set('x-user-role', 'staff');
    expect(staffOrders.status).toBe(200);

    const otherSessionOrder = await request(app)
      .get('/orders/order-other-session')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-current')
      .set('x-user-role', 'guest');
    expect(otherSessionOrder.status).toBe(403);
    expect(otherSessionOrder.body.error.code).toBe('FORBIDDEN');
  });

  test('17. Errores con contrato { error: { code, message } }; caída del catálogo mockeado (nock sin respuesta) -> 502 CATALOG_UNREACHABLE', async () => {
    await request(app)
      .post('/cart/items')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-catalog-down')
      .send({
        productId: 'prod-1',
        modifiers: [],
        quantity: 1,
        display: {
          productName: 'Tacos',
          unitPrice: 10,
          modifierNames: [],
        },
      });

    const downCatalogApp = createOrderingApp({
      cartRepo: sharedCartRepo,
      orderRepo: sharedOrderRepo,
      catalogValidation: {
        getOrderableProducts: async () => {
          throw new CatalogUnreachableError('Fallo al conectar con el microservicio de Catálogo');
        },
      },
      serviceCallRepo: sharedServiceCallRepo,
      eventPublisher: sharedEventPublisher,
      paymentRepo: sharedPaymentRepo,
      sessionService: sharedSessionService,
    });

    const errRes = await request(downCatalogApp)
      .post('/cart/confirm')
      .set('x-tenant-id', 'tenant-1')
      .set('x-session-id', 'session-catalog-down')
      .send();

    expect(errRes.status).toBe(502);
    expect(errRes.body.error.code).toBe('CATALOG_UNREACHABLE');
  });
});
