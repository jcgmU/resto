import request from 'supertest';
import { createSeededOrderingTestApp, sharedCartRepo } from '../helpers/seededOrderingApp';

describe('Integration - Cart Quantity HTTP Validation (U1)', () => {
  const app = createSeededOrderingTestApp();

  beforeEach(() => {
    sharedCartRepo.carts.clear();
  });

  describe('POST /cart/items quantity validation', () => {
    it('defaults quantity to 1 when omitted', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-default-qty')
        .send({
          productId: 'prod-1',
          modifiers: [],
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(1);
    });

    it('accepts boundary quantity 99', async () => {
      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-valid-99')
        .send({
          productId: 'prod-1',
          modifiers: [],
          quantity: 99,
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });

      expect(res.status).toBe(201);
      expect(res.body.items[0].quantity).toBe(99);
    });

    it.each([
      ['zero', 0],
      ['negative', -3],
      ['decimal float', 1.5],
      ['string numeric', '2'],
      ['string non-numeric', 'abc'],
      ['null', null],
      ['boolean true', true],
      ['array', [1]],
      ['object', { qty: 2 }],
      ['exceeds max (100)', 100],
      ['huge value (1000)', 1000],
      ['huge int32 overflow', 2_147_483_648],
    ])('rejects invalid quantity (%s: %p) with 400 VALIDATION_ERROR', async (_, badQuantity) => {
      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-invalid-qty')
        .send({
          productId: 'prod-1',
          modifiers: [],
          quantity: badQuantity,
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects merging when cumulative quantity exceeds 99 and keeps existing cart line untouched', async () => {
      // First add 60 items
      const res1 = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-merge-overflow')
        .send({
          productId: 'prod-1',
          modifiers: [],
          quantity: 60,
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });
      expect(res1.status).toBe(201);
      expect(res1.body.items[0].quantity).toBe(60);

      // Now add 40 more items (60 + 40 = 100 > 99)
      const res2 = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-merge-overflow')
        .send({
          productId: 'prod-1',
          modifiers: [],
          quantity: 40,
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');

      // Verify cart still has 60 items
      const cartRes = await request(app)
        .get('/cart')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-merge-overflow');

      expect(cartRes.status).toBe(200);
      expect(cartRes.body.items).toHaveLength(1);
      expect(cartRes.body.items[0].quantity).toBe(60);
    });
  });

  describe('PATCH /cart/items/:cartItemId quantity validation', () => {
    let cartItemId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/cart/items')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test')
        .send({
          productId: 'prod-1',
          modifiers: [],
          quantity: 5,
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        });
      cartItemId = res.body.items[0].cartItemId;
    });

    it('updates quantity successfully when valid (e.g. 50)', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test')
        .send({ quantity: 50 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(50);
    });

    it('rejects missing quantity field with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects quantity: 0 with 400 VALIDATION_ERROR (DELETE is required)', async () => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test')
        .send({ quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Cart line is not deleted
      const cartRes = await request(app)
        .get('/cart')
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test');
      expect(cartRes.body.items).toHaveLength(1);
      expect(cartRes.body.items[0].quantity).toBe(5);
    });

    it.each([
      ['negative', -1],
      ['float', 2.5],
      ['exceeds 99', 100],
      ['string number', '10'],
      ['null', null],
    ])('rejects invalid quantity in PATCH (%s: %p) with 400 VALIDATION_ERROR', async (_, badQty) => {
      const res = await request(app)
        .patch(`/cart/items/${cartItemId}`)
        .set('x-tenant-id', 'tenant-1')
        .set('x-session-id', 'session-patch-test')
        .send({ quantity: badQty });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
