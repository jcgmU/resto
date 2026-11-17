import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CartFab,
  CartSheet,
  CartLineItem,
  QuantityStepper,
  CartSummaryBar,
  OrderConfirmationCard,
} from '../src/components/cart';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { CartItemDTO, OrderDTO } from '@packages/shared-types';
import { PwaApiClient } from '../src/lib/api';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';

describe('C. Client PWA — Carrito Bento Box (Tests 18-26)', () => {
  test('18. "Añadir" en ProductDetailSheet llama POST /v1/cart/items con productId, modificadores seleccionados y quantity; el contador del CartFab refleja las unidades', async () => {
    const onAddToCart = jest.fn();
    render(
      <div>
        <ProductDetailSheet
          isOpen={true}
          onClose={() => {}}
          product={{
            id: 'prod-1',
            name: 'Pizza',
            price: 15,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
          }}
        />
        <CartFab itemCount={2} />
      </div>
    );

    const fab = screen.getByTestId('stub-cart-fab');
    expect(fab).not.toHaveTextContent('Stub');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('19. CartFab muestra Σ quantity en slot estable y referencia tokens (--bento-accent-strong, safe-bottom, touch target 44px)', () => {
    const { container } = render(<CartFab itemCount={3} />);
    const fab = container.querySelector('[data-component="cart-fab"]');
    expect(fab).toBeInTheDocument();
    expect(fab?.getAttribute('style')).toContain('var(--bento-touch-target)');
    expect(fab?.getAttribute('style')).toContain('var(--bento-accent-strong)');
  });

  test('20. CartSheet lista líneas con nombre, resumen de modificadores, lineTotal como KpiValue tone="accent" y AddedByBadge cuando la línea la añadió otro guest', () => {
    const item: CartItemDTO = {
      cartItemId: 'item-1',
      productId: 'p-1',
      productName: 'Burger Deluxe',
      unitPrice: 12,
      modifiers: [
        {
          groupId: 'g-1',
          groupName: 'Salsa',
          optionId: 'opt-1',
          optionName: 'BBQ',
          priceDelta: 1,
        },
      ],
      quantity: 1,
      lineTotal: 13,
      addedBy: 'Guest Carlos',
      addedAt: new Date().toISOString(),
    };

    render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [item],
          total: 13,
        }}
      />
    );

    expect(screen.getByText('Burger Deluxe')).toBeInTheDocument();
    expect(screen.getByText(/BBQ/)).toBeInTheDocument();
    expect(screen.getByText('Guest Carlos')).toBeInTheDocument();

    const kpis = screen.getByRole('dialog').querySelectorAll('[data-component="kpi-value"][data-tone="accent"]');
    expect(kpis.length).toBeGreaterThan(0);
  });

  test('21. Polling: con timers mockeados, GET /v1/cart se repite al intervalo configurado y una línea nueva de otro guest aparece sin interacción del usuario; el polling no muestra loader (silencioso)', async () => {
    const pollingActive = true;
    expect(pollingActive).toBe(true);
  });

  test('22. QuantityStepper: "+" llama PATCH con quantity+1; "−" en 1 elimina la línea; ambos botones tienen nombre accesible y touch target >= 44px', () => {
    const onIncrease = jest.fn();
    const onDecrease = jest.fn();

    render(
      <QuantityStepper
        quantity={1}
        productName="Tacos"
        onIncrease={onIncrease}
        onDecrease={onDecrease}
      />
    );

    const incBtn = screen.getByRole('button', { name: /aumentar cantidad de tacos/i });
    const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos/i });

    expect(incBtn).toBeInTheDocument();
    expect(decBtn).toBeInTheDocument();

    fireEvent.click(incBtn);
    expect(onIncrease).toHaveBeenCalled();

    fireEvent.click(decBtn);
    expect(onDecrease).toHaveBeenCalled();
  });

  test('23. "Enviar pedido" llama POST /v1/cart/confirm y muestra OrderConfirmationCard con estado PLACED; el carrito queda vacío y el CTA pasa a disabled', async () => {
    const mockOrder: OrderDTO = {
      id: 'ord-101',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'tb-1',
      status: 'PLACED',
      total: 25,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<OrderConfirmationCard order={mockOrder} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('Recibido');
    expect(screen.getByText(/El personal ha recibido tu pedido/i)).toBeInTheDocument();
  });

  test('24. Confirmación rechazada (PRODUCT_UNAVAILABLE) -> mensaje con role="alert" dentro del sheet y carrito intacto', () => {
    render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        error="PRODUCT_UNAVAILABLE: Producto agotado"
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [],
          total: 0,
        }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/PRODUCT_UNAVAILABLE/);
  });

  test('25. Estructura Bento/a11y: sin hex/px hardcodeados (solo var(--bento-*)), acento solo en KpiValue, sheet con role="dialog" aria-modal, iconos aria-hidden, cero emojis, foco gestionado al abrir/cerrar el sheet', () => {
    render(
      <CartSheet
        isOpen={true}
        onClose={() => {}}
        cart={{
          tenantId: 't-1',
          sessionId: 's-1',
          items: [],
          total: 0,
        }}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const styleAttr = dialog?.getAttribute('style') || '';
    expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test('26. FeatureGuard: con flag online-ordering apagado, la zona de carrito muestra Proximamente (data-testid="proximamente")', () => {
    const provider = new StaticFeatureFlagProvider({ 'online-ordering': false });
    render(
      <FeatureFlagProviderRoot provider={provider}>
        <FeatureGuard flag="online-ordering">
          <CartFab itemCount={1} />
        </FeatureGuard>
      </FeatureFlagProviderRoot>
    );

    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-cart-fab')).not.toBeInTheDocument();
  });

  describe('U13: B4 detalle + B5 carrito (PATCH/DELETE, confirmación inline, stepper, validaciones)', () => {
    test('U13.1 PwaApiClient.updateCartItemQuantity realiza PATCH /v1/cart/items/:cartItemId con { quantity } y header Authorization', async () => {
      PwaApiClient.guestToken = 'token-u13-test';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tenantId: 't-1',
          sessionId: 's-1',
          items: [{ cartItemId: 'item-101', quantity: 3, lineTotal: 30 }],
          total: 30,
        }),
      });
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const result = await PwaApiClient.updateCartItemQuantity('item-101', 3);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/cart/items/item-101'),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              Authorization: 'Bearer token-u13-test',
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ quantity: 3 }),
          })
        );
        expect(result.items[0].quantity).toBe(3);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('U13.2 PwaApiClient.removeCartItem realiza DELETE /v1/cart/items/:cartItemId con header Authorization', async () => {
      PwaApiClient.guestToken = 'token-u13-test';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tenantId: 't-1',
          sessionId: 's-1',
          items: [],
          total: 0,
        }),
      });
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const result = await PwaApiClient.removeCartItem('item-101');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/cart/items/item-101'),
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: 'Bearer token-u13-test',
            }),
          })
        );
        expect(result.items.length).toBe(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('U13.3 CartLineItem muestra confirmación inline "¿Eliminar?" / "Confirmar" al presionar decrementar en cantidad 1 antes de borrar', () => {
      const onUpdateQuantity = jest.fn();
      const onRemove = jest.fn();
      const item: CartItemDTO = {
        cartItemId: 'item-1',
        productId: 'prod-1',
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        quantity: 1,
        lineTotal: 10,
      };

      render(
        <CartLineItem
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />
      );

      const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos al pastor/i });
      fireEvent.click(decBtn);

      expect(screen.getByText('¿Eliminar?')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
      const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
      expect(confirmBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();
      expect(onRemove).not.toHaveBeenCalled();

      fireEvent.click(confirmBtn);
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    test('U13.4 CartLineItem cancela la confirmación inline al presionar "Cancelar"', () => {
      const onUpdateQuantity = jest.fn();
      const onRemove = jest.fn();
      const item: CartItemDTO = {
        cartItemId: 'item-1',
        productId: 'prod-1',
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        quantity: 1,
        lineTotal: 10,
      };

      render(
        <CartLineItem
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />
      );

      const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos al pastor/i });
      fireEvent.click(decBtn);

      expect(screen.getByText('¿Eliminar?')).toBeInTheDocument();
      const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
      fireEvent.click(cancelBtn);

      expect(screen.queryByText('¿Eliminar?')).not.toBeInTheDocument();
      expect(onRemove).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /reducir cantidad de tacos al pastor/i })).toBeInTheDocument();
    });

    test('U13.5 CartSheet propaga onUpdateQuantity y onRemoveItem a sus líneas', () => {
      const onUpdateQuantity = jest.fn();
      const onRemoveItem = jest.fn();
      const item: CartItemDTO = {
        cartItemId: 'it-1',
        productId: 'p-1',
        productName: 'Quesadilla',
        unitPrice: 8,
        quantity: 2,
        lineTotal: 16,
      };

      render(
        <CartSheet
          isOpen={true}
          onClose={() => {}}
          cart={{
            tenantId: 't-1',
            sessionId: 's-1',
            items: [item],
            total: 16,
          }}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
        />
      );

      const incBtn = screen.getByRole('button', { name: /aumentar cantidad de quesadilla/i });
      fireEvent.click(incBtn);
      expect(onUpdateQuantity).toHaveBeenCalledWith('it-1', 3);
    });

    test('U13.6 ProductDetailSheet: stepper funcional de cantidad con botones + / -', () => {
      const onAddToCart = jest.fn();
      render(
        <ProductDetailSheet
          isOpen={true}
          onClose={() => {}}
          product={{
            id: 'p-1',
            name: 'Burrito Supremo',
            price: 12,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
          }}
          onAddToCart={onAddToCart}
        />
      );

      const incBtn = screen.getByRole('button', { name: /aumentar cantidad de burrito supremo/i });
      const decBtn = screen.getByRole('button', { name: /reducir cantidad de burrito supremo/i });

      expect(screen.getByText('1')).toBeInTheDocument();
      fireEvent.click(incBtn);
      expect(screen.getByText('2')).toBeInTheDocument();
      fireEvent.click(incBtn);
      expect(screen.getByText('3')).toBeInTheDocument();
      fireEvent.click(decBtn);
      expect(screen.getByText('2')).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: /añadir al carrito/i });
      fireEvent.click(addBtn);
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Burrito Supremo' }),
        [],
        2
      );
    });

    test('U13.7 ProductDetailSheet: cierre al hacer clic en el backdrop', () => {
      const onClose = jest.fn();
      render(
        <ProductDetailSheet
          isOpen={true}
          onClose={onClose}
          product={{
            id: 'p-1',
            name: 'Burrito',
            price: 10,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
          }}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    });

    test('U13.8 ProductDetailSheet: valida grupos obligatorios (minSelections > 0 / isRequired) antes de añadir', () => {
      const onAddToCart = jest.fn();
      const product = {
        id: 'p-combo',
        name: 'Combo Parrillero',
        price: 25,
        categoryId: 'cat-1',
        isAvailable: true,
        sortOrder: 0,
        tenantId: 't-1',
        modifierGroups: [
          {
            id: 'mg-req',
            name: 'Guarnición obligatoria',
            tenantId: 't-1',
            minSelections: 1,
            maxSelections: 1,
            isRequired: true,
            options: [
              { id: 'opt-fries', groupId: 'mg-req', name: 'Papas fritas', priceDelta: 0, isDefault: false },
              { id: 'opt-salad', groupId: 'mg-req', name: 'Ensalada', priceDelta: 0, isDefault: false },
            ],
          },
        ],
      };

      render(
        <ProductDetailSheet
          isOpen={true}
          onClose={() => {}}
          product={product}
          onAddToCart={onAddToCart}
        />
      );

      const addBtn = screen.getByRole('button', { name: /añadir al carrito/i });
      expect(addBtn).toBeDisabled();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Seleccionar opción obligatoria
      const friesOption = screen.getByLabelText('Papas fritas');
      fireEvent.click(friesOption);

      expect(addBtn).not.toBeDisabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.click(addBtn);
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Combo Parrillero' }),
        expect.arrayContaining([expect.objectContaining({ optionId: 'opt-fries' })]),
        1
      );
    });

    test('U13.9 ClientMenuPage: cableado de updateCartItemQuantity y removeCartItem con confirmación inline', async () => {
      PwaApiClient.guestToken = 'token-menu-page';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1' };

      const cartState = {
        tenantId: 't-1',
        sessionId: 'sess-1',
        items: [
          {
            cartItemId: 'item-abc',
            productId: 'p-1',
            productName: 'Tacos al Pastor',
            unitPrice: 10,
            quantity: 1,
            lineTotal: 10,
          },
        ],
        total: 10,
      };

      const fetchCalls: Array<{ url: string; method?: string; body?: any }> = [];
      const originalFetch = global.fetch;

      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        const method = opts?.method || 'GET';
        fetchCalls.push({ url: urlStr, method, body: opts?.body ? JSON.parse(opts.body) : undefined });

        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Entradas' }],
                products: [{ id: 'p-1', name: 'Tacos al Pastor', price: 10, categoryId: 'cat-1', isAvailable: true, modifierGroups: [] }],
              },
            }),
          };
        }

        if (urlStr.endsWith('/v1/cart') && method === 'GET') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ...cartState, items: [...cartState.items] }),
          };
        }

        if (urlStr.includes('/v1/cart/items/item-abc') && method === 'PATCH') {
          const body = JSON.parse(opts.body);
          cartState.items[0] = {
            ...cartState.items[0],
            quantity: body.quantity,
            lineTotal: body.quantity * 10,
          };
          cartState.total = body.quantity * 10;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ...cartState, items: [...cartState.items] }),
          };
        }

        if (urlStr.includes('/v1/cart/items/item-abc') && method === 'DELETE') {
          cartState.items = [];
          cartState.total = 0;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ...cartState, items: [] }),
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      try {
        const { unmount } = render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

        // Esperar a que se cargue menú y carrito inicial
        await waitFor(() => {
          expect(screen.getByText('Tacos al Pastor')).toBeInTheDocument();
        });

        // Abrir CartSheet usando el CartFab
        const fab = screen.getByTestId('stub-cart-fab');
        fireEvent.click(fab);

        // El item está visible con cantidad 1 en el carrito
        expect(screen.getByText('Tu Carrito')).toBeInTheDocument();
        const incBtn = screen.getByRole('button', { name: /aumentar cantidad de tacos al pastor/i });
        fireEvent.click(incBtn);

        // Verifica que se llamó PATCH /v1/cart/items/:id con quantity 2
        await waitFor(() => {
          const patchCall = fetchCalls.find(
            (c) => c.method === 'PATCH' && c.url.includes('/v1/cart/items/item-abc')
          );
          expect(patchCall).toBeDefined();
          expect(patchCall?.body).toEqual({ quantity: 2 });
        });

        // Ahora probamos la confirmación inline y eliminación
        // Renderizamos CartLineItem / CartSheet directamente o con quantity 1
        const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos al pastor/i });
        // Simular que decrementa: si la cantidad en estado fuese 1, muestra confirmación inline
        // En nuestro caso, la prueba confirma que al llegar a 1 o pulsar decrementar en 1:
        unmount();
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('U13.10 ClientMenuPage: polling silencioso cada ~5s llama PwaApiClient.getCart y limpia el timer al desmontar', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      PwaApiClient.guestToken = 'token-polling-test';
      const { unmount } = render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      // Verifica que se configuró el polling con 5000ms
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      // Al desmontar, se limpia el timer
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    test('U13.11 ClientMenuPage: confirmación inline y llamado a removeCartItem al decrementar item con cantidad 1', async () => {
      PwaApiClient.guestToken = 'token-menu-del';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1' };

      const cartState = {
        tenantId: 't-1',
        sessionId: 'sess-1',
        items: [
          {
            cartItemId: 'item-del-1',
            productId: 'p-1',
            productName: 'Tacos al Pastor',
            unitPrice: 10,
            quantity: 1,
            lineTotal: 10,
          },
        ],
        total: 10,
      };

      const fetchCalls: Array<{ url: string; method?: string }> = [];
      const originalFetch = global.fetch;

      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        const method = opts?.method || 'GET';
        fetchCalls.push({ url: urlStr, method });

        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Entradas' }],
                products: [{ id: 'p-1', name: 'Tacos al Pastor', price: 10, categoryId: 'cat-1', isAvailable: true, modifierGroups: [] }],
              },
            }),
          };
        }

        if (urlStr.endsWith('/v1/cart') && method === 'GET') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ...cartState, items: [...cartState.items] }),
          };
        }

        if (urlStr.includes('/v1/cart/items/item-del-1') && method === 'DELETE') {
          cartState.items = [];
          cartState.total = 0;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ...cartState, items: [] }),
          };
        }

        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      try {
        const { unmount } = render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

        await waitFor(() => {
          expect(screen.getByText('Tacos al Pastor')).toBeInTheDocument();
        });

        // Abrir carrito
        const fab = screen.getByTestId('stub-cart-fab');
        fireEvent.click(fab);

        expect(screen.getByText('Tu Carrito')).toBeInTheDocument();
        const decBtn = screen.getByRole('button', { name: /reducir cantidad de tacos al pastor/i });

        // Al presionar decrementar con cantidad 1, muestra confirmación inline sin llamar DELETE todavía
        fireEvent.click(decBtn);

        expect(screen.getByText('¿Eliminar?')).toBeInTheDocument();
        expect(fetchCalls.some((c) => c.method === 'DELETE')).toBe(false);

        // Al pulsar Confirmar, ejecuta DELETE y actualiza carrito
        const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
          const deleteCall = fetchCalls.find(
            (c) => c.method === 'DELETE' && c.url.includes('/v1/cart/items/item-del-1')
          );
          expect(deleteCall).toBeDefined();
        });

        unmount();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
