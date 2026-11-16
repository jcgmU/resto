import { ValidationError } from '../../src/domain/errors';
import {
  MAX_ITEM_QUANTITY,
  MIN_ITEM_QUANTITY,
  parseCartItemQuantity,
  validateQuantity,
} from '../../src/domain/validation';
import { validateAndPriceCart } from '../../src/domain/pricing';
import { CartUseCases } from '../../src/application/CartUseCases';
import { InMemoryCartRepository } from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';

describe('Unit - Quantity & Monetary Validation (U1)', () => {
  describe('validateQuantity & parseCartItemQuantity', () => {
    it('accepts integer quantities between 1 and 99', () => {
      expect(validateQuantity(1)).toBe(1);
      expect(validateQuantity(2)).toBe(2);
      expect(validateQuantity(50)).toBe(50);
      expect(validateQuantity(98)).toBe(98);
      expect(validateQuantity(99)).toBe(99);
    });

    it('rejects numbers outside [1, 99]', () => {
      expect(() => validateQuantity(0)).toThrow(ValidationError);
      expect(() => validateQuantity(-1)).toThrow(ValidationError);
      expect(() => validateQuantity(-3)).toThrow(ValidationError);
      expect(() => validateQuantity(100)).toThrow(ValidationError);
      expect(() => validateQuantity(1000)).toThrow(ValidationError);
      expect(() => validateQuantity(2_147_483_648)).toThrow(ValidationError);
      expect(() => validateQuantity(Number.MAX_SAFE_INTEGER)).toThrow(ValidationError);
      expect(() => validateQuantity(1e100)).toThrow(ValidationError);
    });

    it('rejects non-integer numbers (decimals/floats)', () => {
      expect(() => validateQuantity(1.5)).toThrow(ValidationError);
      expect(() => validateQuantity(0.99)).toThrow(ValidationError);
      expect(() => validateQuantity(2.0001)).toThrow(ValidationError);
    });

    it('rejects NaN, Infinity, -Infinity', () => {
      expect(() => validateQuantity(NaN)).toThrow(ValidationError);
      expect(() => validateQuantity(Infinity)).toThrow(ValidationError);
      expect(() => validateQuantity(-Infinity)).toThrow(ValidationError);
    });

    it('rejects non-number types without string coercion', () => {
      expect(() => validateQuantity('2')).toThrow(ValidationError);
      expect(() => validateQuantity('abc')).toThrow(ValidationError);
      expect(() => validateQuantity('')).toThrow(ValidationError);
      expect(() => validateQuantity(null)).toThrow(ValidationError);
      expect(() => validateQuantity(undefined)).toThrow(ValidationError);
      expect(() => validateQuantity(true)).toThrow(ValidationError);
      expect(() => validateQuantity(false)).toThrow(ValidationError);
      expect(() => validateQuantity([])).toThrow(ValidationError);
      expect(() => validateQuantity([1])).toThrow(ValidationError);
      expect(() => validateQuantity({})).toThrow(ValidationError);
    });

    it('parseCartItemQuantity defaults to 1 only when undefined', () => {
      expect(parseCartItemQuantity(undefined)).toBe(1);
      expect(parseCartItemQuantity(5)).toBe(5);
      expect(() => parseCartItemQuantity(null)).toThrow(ValidationError);
      expect(() => parseCartItemQuantity(0)).toThrow(ValidationError);
      expect(() => parseCartItemQuantity('1')).toThrow(ValidationError);
    });
  });

  describe('pricing domain validation (pricing.ts)', () => {
    const products = [
      {
        productId: 'prod-1',
        name: 'Tacos',
        price: 10,
        isAvailable: true,
        modifierGroups: [],
      },
      {
        productId: 'prod-expensive',
        name: 'Gold Plate',
        price: 50_000_000,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    it('prices valid cart items successfully', () => {
      const items = [
        {
          cartItemId: 'item-1',
          productId: 'prod-1',
          productName: 'Tacos',
          unitPrice: 10,
          quantity: 5,
          modifiers: [],
          addedBy: 'User',
          addedAt: new Date().toISOString(),
          lineTotal: 50,
        },
      ];
      const result = validateAndPriceCart(items, products);
      expect(result.total).toBe(50);
      expect(result.items[0].quantity).toBe(5);
    });

    it('rejects cart items with invalid quantity (-3, 0, 100, NaN, Infinity)', () => {
      const baseItem = {
        cartItemId: 'item-bad',
        productId: 'prod-1',
        productName: 'Tacos',
        unitPrice: 10,
        modifiers: [],
        addedBy: 'User',
        addedAt: new Date().toISOString(),
        lineTotal: 10,
      };

      for (const badQty of [-3, 0, 1.5, 100, 1000, NaN, Infinity, -Infinity]) {
        expect(() =>
          validateAndPriceCart([{ ...baseItem, quantity: badQty as any }], products)
        ).toThrow(ValidationError);
      }
    });

    it('rejects orders whose total exceeds Decimal(10,2) limit (99,999,999.99)', () => {
      const items = [
        {
          cartItemId: 'item-overflow',
          productId: 'prod-expensive',
          productName: 'Gold Plate',
          unitPrice: 50_000_000,
          quantity: 3, // 150,000,000 > 99,999,999.99
          modifiers: [],
          addedBy: 'User',
          addedAt: new Date().toISOString(),
          lineTotal: 150_000_000,
        },
      ];
      expect(() => validateAndPriceCart(items, products)).toThrow(ValidationError);
    });
  });

  describe('CartUseCases merging and quantity limits', () => {
    let cartRepo: InMemoryCartRepository;
    let cartUseCases: CartUseCases;

    beforeEach(() => {
      cartRepo = new InMemoryCartRepository();
      cartUseCases = new CartUseCases(cartRepo);
    });

    it('merges cart lines when total quantity <= 99', async () => {
      await cartUseCases.addCartItem.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        productId: 'prod-1',
        modifiers: [],
        quantity: 60,
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });

      const updated = await cartUseCases.addCartItem.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        productId: 'prod-1',
        modifiers: [],
        quantity: 39,
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].quantity).toBe(99);
    });

    it('rejects merging when total quantity exceeds 99 without modifying cart', async () => {
      await cartUseCases.addCartItem.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        productId: 'prod-1',
        modifiers: [],
        quantity: 60,
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });

      await expect(
        cartUseCases.addCartItem.execute({
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          productId: 'prod-1',
          modifiers: [],
          quantity: 40, // 60 + 40 = 100 > 99
          display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
        })
      ).rejects.toThrow(ValidationError);

      const cart = await cartUseCases.getCart.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
      });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(60);
    });

    it('rejects updating quantity to 0, negative or > 99 with ValidationError', async () => {
      const initial = await cartUseCases.addCartItem.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        productId: 'prod-1',
        modifiers: [],
        quantity: 5,
        display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
      });
      const itemId = initial.items[0].cartItemId;

      await expect(
        cartUseCases.updateCartItemQuantity.execute({
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          cartItemId: itemId,
          quantity: 0,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        cartUseCases.updateCartItemQuantity.execute({
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          cartItemId: itemId,
          quantity: -3,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        cartUseCases.updateCartItemQuantity.execute({
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          cartItemId: itemId,
          quantity: 100,
        })
      ).rejects.toThrow(ValidationError);

      // Cart line is untouched
      const cart = await cartUseCases.getCart.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
      });
      expect(cart.items[0].quantity).toBe(5);
    });
  });
});
