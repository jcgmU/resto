import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';
import { OrderDTO } from '@packages/shared-types';

describe('U5 — H3: Recarga recupera seguimiento del pedido + Aviso 409 SESSION_NOT_ORDERABLE al añadir al carrito', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    act(() => {
      PwaApiClient.clearAuth();
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    act(() => {
      PwaApiClient.clearAuth();
    });
  });

  test('H3: Con guestToken y sesión en sessionStorage tras recargar (sin estado previo en memoria), montar ClientMenuPage sin interacción muestra el seguimiento de la orden en IN_KITCHEN', async () => {
    // Simulamos el estado tras F5 / recarga: los datos viven únicamente en sessionStorage
    window.sessionStorage.setItem('resto_guest_token', 'guest-token-reload-h3');
    window.sessionStorage.setItem(
      'resto_guest_session',
      JSON.stringify({
        sessionId: 'sess-reload-h3',
        tenantId: 'tenant-h3',
        tableId: 'tb-h3',
        status: 'active',
      })
    );

    const activeOrderInKitchen: OrderDTO = {
      id: 'ord-12345',
      tenantId: 'tenant-h3',
      sessionId: 'sess-reload-h3',
      tableId: 'tb-h3',
      status: 'IN_KITCHEN',
      total: 42000,
      items: [],
      createdAt: new Date().toISOString(),
    };

    let ordersRequestedWithAuth: string | null = null;

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Principales' }],
              products: [
                {
                  id: 'prod-1',
                  name: 'Bandeja Paisa',
                  price: 42000,
                  categoryId: 'cat-1',
                  isAvailable: true,
                },
              ],
            },
          }),
        };
      }
      if (urlStr.endsWith('/v1/cart')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ tenantId: 'tenant-h3', sessionId: 'sess-reload-h3', items: [], total: 0 }),
        };
      }
      if (urlStr.endsWith('/v1/orders')) {
        ordersRequestedWithAuth = opts?.headers?.Authorization || null;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [activeOrderInKitchen],
        };
      }
      if (urlStr.includes('/v1/tenant/settings')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ operatingMode: 'hybrid' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    const { container } = render(
      <ClientMenuPage params={{ tenantId: 'tenant-h3', tableId: 'tb-h3' }} />
    );

    // Sin ninguna interacción del usuario, debe recuperar la orden y mostrar el seguimiento
    await waitFor(() => {
      expect(screen.getByText('Orden #12345')).toBeInTheDocument();
    });

    expect(ordersRequestedWithAuth).toBe('Bearer guest-token-reload-h3');
    expect(screen.getByTestId('session-orders-list')).toBeInTheDocument();

    // El paso activo en ProgressNodes debe ser "En cocina"
    const currentStep = container.querySelector('li[aria-current="step"]');
    expect(currentStep).toHaveTextContent('En cocina');
    expect(screen.getByText(/Tu pedido se está preparando en la cocina/i)).toBeInTheDocument();
  });

  test('Aviso 409 SESSION_NOT_ORDERABLE: cuando addToCart rechaza con 409 SESSION_NOT_ORDERABLE al añadir un producto, muestra un aviso visible con role="alert"', async () => {
    window.sessionStorage.setItem('resto_guest_token', 'guest-token-409-h3');
    window.sessionStorage.setItem(
      'resto_guest_session',
      JSON.stringify({
        sessionId: 'sess-409-h3',
        tenantId: 'tenant-h3',
        tableId: 'tb-h3',
        status: 'active',
      })
    );

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      const method = opts?.method || 'GET';

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Principales' }],
              products: [
                {
                  id: 'prod-1',
                  name: 'Lomo Saltado',
                  price: 38000,
                  categoryId: 'cat-1',
                  isAvailable: true,
                  modifierGroups: [],
                },
              ],
            },
          }),
        };
      }
      if (urlStr.endsWith('/v1/cart') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ tenantId: 'tenant-h3', sessionId: 'sess-409-h3', items: [], total: 0 }),
        };
      }
      if (urlStr.endsWith('/v1/orders')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }
      if (urlStr.includes('/v1/cart/items') && method === 'POST') {
        return {
          ok: false,
          status: 409,
          headers: { get: () => 'application/json' },
          json: async () => ({
            error: {
              code: 'SESSION_NOT_ORDERABLE',
              message: 'Session is not orderable',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<ClientMenuPage params={{ tenantId: 'tenant-h3', tableId: 'tb-h3' }} />);

    // Esperar a que cargue el producto en la carta
    const productCard = await screen.findByText('Lomo Saltado');
    fireEvent.click(productCard);

    // Pulsar "Añadir al carrito" en ProductDetailSheet
    const addBtn = await screen.findByRole('button', { name: /añadir al carrito/i });
    fireEvent.click(addBtn);

    // Debe mostrarse un aviso visible con role="alert" y texto claro en español
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/la cuenta ya fue solicitada y no se pueden agregar más pedidos/i);
  });
});
