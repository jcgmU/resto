import { CartUseCases } from '../../src/application/CartUseCases';
import { OrderUseCases } from '../../src/application/OrderUseCases';
import { ValidationError } from '../../src/domain/errors';
import {
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryCatalogValidationAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';

describe('A. Ordering — unitarios de casos de uso (Tests 1-12)', () => {
  let cartRepo: InMemoryCartRepository;
  let orderRepo: InMemoryOrderRepository;
  let catalogValidation: InMemoryCatalogValidationAdapter;
  let cartUseCases: CartUseCases;
  let orderUseCases: OrderUseCases;

  beforeEach(() => {
    cartRepo = new InMemoryCartRepository();
    orderRepo = new InMemoryOrderRepository();
    catalogValidation = new InMemoryCatalogValidationAdapter();
    cartUseCases = new CartUseCases(cartRepo);
    orderUseCases = new OrderUseCases(orderRepo, cartRepo, catalogValidation);
  });

  test('1. AddCartItem agrega línea nueva al carrito de la sesión', async () => {
    const cart = await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-1',
      modifiers: [{ groupId: 'grp-1', optionId: 'opt-1' }],
      quantity: 2,
      display: {
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        modifierNames: [{ groupName: 'Salsa', optionName: 'Verde', priceDelta: 0 }],
      },
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('prod-1');
    expect(cart.items[0].quantity).toBe(2);
  });

  test('2. AddCartItem con mismo productId + mismos modificadores -> incrementa quantity (merge), NO duplica línea', async () => {
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-1',
      modifiers: [{ groupId: 'grp-1', optionId: 'opt-1' }],
      quantity: 1,
      display: {
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        modifierNames: [{ groupName: 'Salsa', optionName: 'Verde', priceDelta: 0 }],
      },
    });

    const updatedCart = await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-1',
      modifiers: [{ groupId: 'grp-1', optionId: 'opt-1' }],
      quantity: 2,
      display: {
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        modifierNames: [{ groupName: 'Salsa', optionName: 'Verde', priceDelta: 0 }],
      },
    });

    expect(updatedCart.items).toHaveLength(1);
    expect(updatedCart.items[0].quantity).toBe(3);
  });

  test('3. UpdateCartItemQuantity con quantity > 0 actualiza; con quantity = 0 elimina la línea', async () => {
    const cart = await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-1',
      modifiers: [],
      quantity: 2,
      display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
    });
    const itemId = cart.items[0].cartItemId;

    const updated = await cartUseCases.updateCartItemQuantity.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      cartItemId: itemId,
      quantity: 5,
    });
    expect(updated.items[0].quantity).toBe(5);

    await expect(
      cartUseCases.updateCartItemQuantity.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        cartItemId: itemId,
        quantity: 0,
      })
    ).rejects.toThrow(ValidationError);
  });

  test('4. RemoveCartItem elimina solo esa línea; las demás quedan intactas', async () => {
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-1',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Tacos', unitPrice: 10, modifierNames: [] },
    });
    const cart2 = await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-2',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Refresco', unitPrice: 3, modifierNames: [] },
    });

    const itemToRemove = cart2.items.find((i) => i.productId === 'prod-1')!;
    const finalCart = await cartUseCases.removeCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      cartItemId: itemToRemove.cartItemId,
    });

    expect(finalCart.items).toHaveLength(1);
    expect(finalCart.items[0].productId).toBe('prod-2');
  });

  test('5. ConfirmOrder con carrito vacío -> CART_EMPTY', async () => {
    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-empty',
        tableId: 'table-1',
      })
    ).rejects.toThrow('CART_EMPTY');
  });

  test('6. ConfirmOrder con productId inexistente en catálogo -> PRODUCT_NOT_FOUND y NO persiste nada', async () => {
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'non-existent',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Fantasma', unitPrice: 10, modifierNames: [] },
    });

    catalogValidation.products = [];

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        tableId: 'table-1',
      })
    ).rejects.toThrow('PRODUCT_NOT_FOUND');

    expect(orderRepo.orders).toHaveLength(0);
  });

  test('7. ConfirmOrder con producto isAvailable=false -> PRODUCT_UNAVAILABLE', async () => {
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      productId: 'prod-unavailable',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Agotado', unitPrice: 10, modifierNames: [] },
    });

    catalogValidation.products = [
      {
        productId: 'prod-unavailable',
        name: 'Agotado',
        price: 10,
        isAvailable: false,
        modifierGroups: [],
      },
    ];

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        tableId: 'table-1',
      })
    ).rejects.toThrow('PRODUCT_UNAVAILABLE');
  });

  test('8. ConfirmOrder con grupo obligatorio sin selección -> MODIFIER_REQUIRED; con más opciones de maxSelections -> MODIFIER_INVALID', async () => {
    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Burger',
        price: 15,
        isAvailable: true,
        modifierGroups: [
          {
            groupId: 'grp-req',
            name: 'Término',
            isRequired: true,
            minSelections: 1,
            maxSelections: 1,
            options: [{ optionId: 'opt-1', name: 'Medio', priceDelta: 0 }],
          },
          {
            groupId: 'grp-extra',
            name: 'Toppings',
            isRequired: false,
            minSelections: 0,
            maxSelections: 1,
            options: [
              { optionId: 'top-1', name: 'Queso', priceDelta: 1 },
              { optionId: 'top-2', name: 'Tocineta', priceDelta: 2 },
            ],
          },
        ],
      },
    ];

    // Falta grupo obligatorio
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-req-missing',
      productId: 'prod-1',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Burger', unitPrice: 15, modifierNames: [] },
    });

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-req-missing',
        tableId: 'table-1',
      })
    ).rejects.toThrow('MODIFIER_REQUIRED');

    // Excede maxSelections
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-max-exceeded',
      productId: 'prod-1',
      modifiers: [
        { groupId: 'grp-req', optionId: 'opt-1' },
        { groupId: 'grp-extra', optionId: 'top-1' },
        { groupId: 'grp-extra', optionId: 'top-2' },
      ],
      quantity: 1,
      display: { productName: 'Burger', unitPrice: 18, modifierNames: [] },
    });

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-max-exceeded',
        tableId: 'table-1',
      })
    ).rejects.toThrow('MODIFIER_INVALID');
  });

  test('9. ConfirmOrder recalcula precios desde el puerto de catálogo: un unitPrice de display manipulado en el carrito NO afecta al total; total = Σ (precioCatálogo + Σ priceDelta) × quantity', async () => {
    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Plato Real',
        price: 20,
        isAvailable: true,
        modifierGroups: [
          {
            groupId: 'g-1',
            name: 'Extra',
            isRequired: false,
            minSelections: 0,
            maxSelections: 2,
            options: [{ optionId: 'opt-1', name: 'Queso Extra', priceDelta: 3 }],
          },
        ],
      },
    ];

    // Cliente malicioso envía unitPrice: 1 en lugar de 20
    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-hack',
      productId: 'prod-1',
      modifiers: [{ groupId: 'g-1', optionId: 'opt-1' }],
      quantity: 2,
      display: {
        productName: 'Plato Real',
        unitPrice: 1,
        modifierNames: [{ groupName: 'Extra', optionName: 'Queso Extra', priceDelta: 0 }],
      },
    });

    const order = await orderUseCases.confirmOrder.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-hack',
      tableId: 'table-1',
    });

    // Total recalculado por catálogo: (20 + 3) * 2 = 46
    expect(order.total).toBe(46);
    expect(order.items[0].unitPrice).toBe(20);
    expect(order.items[0].modifiers[0].priceDelta).toBe(3);
  });

  test('10. ConfirmOrder persiste la Order con snapshots (nombre/precio/modificadores del momento de confirmar) y limpia el carrito: un GetCart posterior devuelve vacío', async () => {
    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Pizza Napolitana',
        price: 14,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-10',
      productId: 'prod-1',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Pizza Napolitana', unitPrice: 14, modifierNames: [] },
    });

    const order = await orderUseCases.confirmOrder.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-10',
      tableId: 'table-1',
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe('PLACED');
    expect(order.items[0].productName).toBe('Pizza Napolitana');

    const emptyCart = await cartUseCases.getCart.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-10',
    });
    expect(emptyCart.items).toHaveLength(0);
  });

  test('11. ConfirmOrder es atómico: si OrderRepository.save falla, el carrito NO se limpia', async () => {
    catalogValidation.products = [
      {
        productId: 'prod-1',
        name: 'Plato',
        price: 10,
        isAvailable: true,
        modifierGroups: [],
      },
    ];

    await cartUseCases.addCartItem.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-fail',
      productId: 'prod-1',
      modifiers: [],
      quantity: 1,
      display: { productName: 'Plato', unitPrice: 10, modifierNames: [] },
    });

    orderRepo.save = jest.fn().mockRejectedValue(new Error('DB_FAILURE'));

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId: 'tenant-1',
        sessionId: 'session-fail',
        tableId: 'table-1',
      })
    ).rejects.toThrow('DB_FAILURE');

    const cartAfterFailure = await cartUseCases.getCart.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-fail',
    });
    expect(cartAfterFailure.items).toHaveLength(1);
  });

  test('12. GetOrder como guest de otra sesión -> FORBIDDEN; ListSessionOrders devuelve solo las orders de esa sesión', async () => {
    orderRepo.orders = [
      {
        id: 'ord-1',
        tenantId: 'tenant-1',
        sessionId: 'session-A',
        tableId: 'table-1',
        status: 'PLACED',
        total: 25,
        items: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-2',
        tenantId: 'tenant-1',
        sessionId: 'session-B',
        tableId: 'table-2',
        status: 'PLACED',
        total: 40,
        items: [],
        createdAt: new Date().toISOString(),
      },
    ];

    await expect(
      orderUseCases.getOrder.execute({
        tenantId: 'tenant-1',
        orderId: 'ord-1',
        requester: { role: 'guest', sessionId: 'session-B' },
      })
    ).rejects.toThrow('FORBIDDEN');

    const guestAOrders = await orderUseCases.listSessionOrders.execute({
      tenantId: 'tenant-1',
      sessionId: 'session-A',
    });
    expect(guestAOrders).toHaveLength(1);
    expect(guestAOrders[0].id).toBe('ord-1');
  });
});
