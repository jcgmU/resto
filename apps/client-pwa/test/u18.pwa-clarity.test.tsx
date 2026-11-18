import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { GuestSessionGuard } from '../src/components/GuestSessionGuard';
import { PwaApiClient } from '../src/lib/api';
import { OrderDTO } from '@packages/shared-types';

describe('V15 / U03+U04: PWA Claridad y Persistencia de Sesión', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.clearAuth();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    act(() => {
      PwaApiClient.clearAuth();
    });
  });

  describe('1. Filtro de Categorías en menu/page.tsx (U03)', () => {
    test('Con 1 categoría (categories.length <= 1), el tab "Todas" está oculto y solo se muestra la categoría única', async () => {
      PwaApiClient.guestToken = 'token-u18-cat1';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' };

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-unic', name: 'Platos Únicos' }],
                products: [
                  { id: 'p-1', name: 'Plato Especial', price: 20, categoryId: 'cat-unic', isAvailable: true },
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
            json: async () => ({ items: [], total: 0 }),
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
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Plato Especial')).toBeInTheDocument();
      });

      // El tab 'Todas' no debe existir
      expect(screen.queryByRole('tab', { name: /^todas/i })).not.toBeInTheDocument();

      // Debe mostrar el tab de la única categoría
      expect(screen.getByRole('tab', { name: /Platos Únicos/i })).toBeInTheDocument();
    });

    test('Con 2 o más categorías (categories.length >= 2), se muestra el chip "Todas" y las demás pestañas', async () => {
      PwaApiClient.guestToken = 'token-u18-cat2';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' };

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [
                  { id: 'cat-1', name: 'Entradas' },
                  { id: 'cat-2', name: 'Bebidas' },
                ],
                products: [
                  { id: 'p-1', name: 'Empanada', price: 10, categoryId: 'cat-1', isAvailable: true },
                  { id: 'p-2', name: 'Jugo', price: 5, categoryId: 'cat-2', isAvailable: true },
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
            json: async () => ({ items: [], total: 0 }),
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
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Empanada')).toBeInTheDocument();
      });

      // Debe existir el tab 'Todas'
      expect(screen.getByRole('tab', { name: /^todas/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Entradas/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Bebidas/i })).toBeInTheDocument();
    });
  });

  describe('2. Claridad en Estados y Mensajes de Pedido / Mesero (U03+U04)', () => {
    test('Tras confirmar un pedido, muestra "Pedido enviado; ya no puede editarse" y botón "Agregar otro pedido"', async () => {
      PwaApiClient.guestToken = 'token-u18-confirm';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' };

      const cartState = {
        tenantId: 't-1',
        sessionId: 'sess-1',
        items: [
          { cartItemId: 'it-1', productId: 'p-1', productName: 'Pizza', unitPrice: 15, quantity: 1, lineTotal: 15 },
        ],
        total: 15,
      };

      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        const method = opts?.method || 'GET';

        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Comidas' }],
                products: [{ id: 'p-1', name: 'Pizza', price: 15, categoryId: 'cat-1', isAvailable: true }],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart') && method === 'GET') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => cartState,
          };
        }
        if (urlStr.includes('/v1/cart/confirm') && method === 'POST') {
          cartState.items = [];
          cartState.total = 0;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              id: 'ord-confirm-1',
              sessionId: 'sess-1',
              tenantId: 't-1',
              tableId: 'tb-1',
              status: 'PLACED',
              total: 15,
              items: [],
            }),
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
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });

      // Abrir carrito y confirmar pedido
      const fab = screen.getByTestId('stub-cart-fab');
      fireEvent.click(fab);

      const confirmBtn = screen.getByRole('button', { name: /enviar pedido/i });
      fireEvent.click(confirmBtn);

      // Verificamos los copys explícitos requeridos
      await waitFor(() => {
        expect(screen.getByText('Pedido enviado; ya no puede editarse')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /agregar otro pedido/i })).toBeInTheDocument();
      });
    });

    test('Llamada al mesero cuando hay pedido en preparación muestra copy "Mesero avisado. Tu pedido sigue en preparación"', async () => {
      PwaApiClient.guestToken = 'token-u18-waiter';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' };

      const activeOrder: OrderDTO = {
        id: 'ord-in-prep-1',
        sessionId: 'sess-1',
        tenantId: 't-1',
        tableId: 'tb-1',
        status: 'IN_KITCHEN',
        total: 30,
        items: [],
        createdAt: new Date().toISOString(),
      };

      let waiterCalled = false;
      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        const method = opts?.method || 'GET';

        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Platos' }],
                products: [{ id: 'p-1', name: 'Ceviche', price: 30, categoryId: 'cat-1', isAvailable: true }],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ items: [], total: 0 }),
          };
        }
        if (urlStr.endsWith('/v1/orders')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => [activeOrder],
          };
        }
        if (urlStr.includes('/v1/service-calls') && method === 'POST') {
          waiterCalled = true;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ callId: 'call-1', status: 'pending' }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      // Esperar a que se cargue la orden previa en cocina
      await waitFor(() => {
        expect(screen.getAllByText('En cocina').length).toBeGreaterThanOrEqual(1);
      });

      // Click en Llamar al mesero
      const callWaiterBtn = screen.getByRole('button', { name: /llamar al mesero/i });
      fireEvent.click(callWaiterBtn);

      await waitFor(() => {
        expect(waiterCalled).toBe(true);
        expect(
          screen.getByText('Mesero avisado. Tu pedido sigue en preparación')
        ).toBeInTheDocument();
      });
    });
  });

  describe('3. Persistencia y Recuperación de Órdenes tras F5 (U04)', () => {
    test('Al montar, recupera todas las órdenes de la sesión (GET /v1/orders) y muestra sus estados supervivientes', async () => {
      PwaApiClient.guestToken = 'token-u18-f5';
      PwaApiClient.session = { sessionId: 'sess-f5', tableId: 'tb-f5', tenantId: 't-f5', status: 'active' };

      const existingOrders: OrderDTO[] = [
        {
          id: 'ord-f5-1',
          sessionId: 'sess-f5',
          tenantId: 't-f5',
          tableId: 'tb-f5',
          status: 'PLACED',
          total: 20,
          items: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ord-f5-2',
          sessionId: 'sess-f5',
          tenantId: 't-f5',
          tableId: 'tb-f5',
          status: 'READY',
          total: 35,
          items: [],
          createdAt: new Date().toISOString(),
        },
      ];

      let getOrdersCalled = false;
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Carta' }],
                products: [],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ items: [], total: 0 }),
          };
        }
        if (urlStr.endsWith('/v1/orders')) {
          getOrdersCalled = true;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => existingOrders,
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-f5', tableId: 'tb-f5' }} />);

      await waitFor(() => {
        expect(getOrdersCalled).toBe(true);
        expect(screen.getAllByText('Recibido').length).toBeGreaterThanOrEqual(1);
      });

      // Ambas órdenes se renderizan con sus respectivos chips de estado
      expect(screen.getAllByText('Listo').length).toBeGreaterThanOrEqual(1);

      // Ambas órdenes muestran el aviso de inmutabilidad y botón de agregar otro pedido
      const lockedNotices = screen.getAllByText('Pedido enviado; ya no puede editarse');
      expect(lockedNotices.length).toBe(2);

      const addButtons = screen.getAllByRole('button', { name: /agregar otro pedido/i });
      expect(addButtons.length).toBe(2);
    });
  });

  describe('4. Bloqueo cuando billRequested (o 409 SESSION_NOT_ORDERABLE) (U03)', () => {
    test('Si la sesión está en billRequested, bloquea agregar al carrito y confirma que no se pueden agregar más pedidos', async () => {
      PwaApiClient.guestToken = 'token-u18-bill';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'billRequested' };

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'General' }],
                products: [{ id: 'p-1', name: 'Hamburguesa', price: 20, categoryId: 'cat-1', isAvailable: true }],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ items: [], total: 0 }),
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
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Hamburguesa')).toBeInTheDocument();
      });

      // El banner de cuenta pedida debe indicar explícitamente que no se pueden agregar más pedidos
      expect(
        screen.getByText('La cuenta ya fue solicitada y no se pueden agregar más pedidos.')
      ).toBeInTheDocument();

      // Abrir detalle del producto
      fireEvent.click(screen.getByText('Hamburguesa'));

      // El modal de detalle debe mostrar el aviso y tener el botón deshabilitado
      expect(screen.getByTestId('order-blocked-sheet-notice')).toHaveTextContent(
        'La cuenta ya fue solicitada y no se pueden agregar más pedidos.'
      );
      const addBtn = screen.getByRole('button', { name: /cuenta solicitada/i });
      expect(addBtn).toBeDisabled();
    });

    test('Si confirmOrder o addToCart responden 409 SESSION_NOT_ORDERABLE, activa billRequested y muestra aviso', async () => {
      PwaApiClient.guestToken = 'token-u18-409';
      PwaApiClient.session = { sessionId: 'sess-1', tableId: 'tb-1', tenantId: 't-1', status: 'active' };

      const cartState = {
        tenantId: 't-1',
        sessionId: 'sess-1',
        items: [{ cartItemId: 'it-1', productId: 'p-1', productName: 'Tacos', unitPrice: 10, quantity: 1, lineTotal: 10 }],
        total: 10,
      };

      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        const method = opts?.method || 'GET';

        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Comidas' }],
                products: [{ id: 'p-1', name: 'Tacos', price: 10, categoryId: 'cat-1', isAvailable: true }],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => cartState,
          };
        }
        if (urlStr.includes('/v1/cart/confirm') && method === 'POST') {
          return {
            ok: false,
            status: 409,
            headers: { get: () => 'application/json' },
            json: async () => ({ code: 'SESSION_NOT_ORDERABLE', message: 'No se puede pedir: cuenta solicitada' }),
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
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Tacos')).toBeInTheDocument();
      });

      // Abrir carrito y confirmar pedido
      fireEvent.click(screen.getByTestId('stub-cart-fab'));
      const confirmBtn = screen.getByRole('button', { name: /enviar pedido/i });
      fireEvent.click(confirmBtn);

      // Ante 409 SESSION_NOT_ORDERABLE, la UI pasa a estado de cuenta pedida y muestra el bloqueo
      await waitFor(() => {
        expect(
          screen.getAllByText('La cuenta ya fue solicitada y no se pueden agregar más pedidos.').length
        ).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('5. Reacción de GuestSessionGuard ante expiración (401 / clearAuth)', () => {
    test('Cuando PwaApiClient.clearAuth() se llama, GuestSessionGuard reacciona de inmediato mostrando pantalla de QR', async () => {
      PwaApiClient.guestToken = 'token-activo-guard';

      render(
        <GuestSessionGuard>
          <div data-testid="contenido-privado">Bienvenido a la mesa</div>
        </GuestSessionGuard>
      );

      // Inicialmente está autenticado
      expect(await screen.findByTestId('contenido-privado')).toBeInTheDocument();

      // Se limpia la autenticación (ej: token revocado o expirado)
      act(() => {
        PwaApiClient.clearAuth();
      });

      // Debe desmontar el contenido privado y mostrar de inmediato la pantalla de escaneo
      await waitFor(() => {
        expect(screen.queryByTestId('contenido-privado')).not.toBeInTheDocument();
        expect(screen.getByTestId('guest-guard-unauthorized')).toBeInTheDocument();
        expect(screen.getByText('Escanea el QR de tu mesa')).toBeInTheDocument();
      });
    });

    test('Cuando una llamada a PwaApiClient lanza 401 por checkAuthExpired, GuestSessionGuard reacciona reactivamente', async () => {
      PwaApiClient.guestToken = 'token-a-expirar';

      render(
        <GuestSessionGuard>
          <div data-testid="contenido-privado">Bienvenido a la mesa</div>
        </GuestSessionGuard>
      );

      expect(await screen.findByTestId('contenido-privado')).toBeInTheDocument();

      // Simular que una llamada recibe 401
      act(() => {
        try {
          PwaApiClient.checkAuthExpired({ status: 401 });
        } catch {
          // Capturar el error arrojado por checkAuthExpired
        }
      });

      // GuestSessionGuard debe reaccionar de inmediato sin necesidad de F5
      await waitFor(() => {
        expect(screen.queryByTestId('contenido-privado')).not.toBeInTheDocument();
        expect(screen.getByTestId('guest-guard-unauthorized')).toBeInTheDocument();
        expect(screen.getByText('Escanea el QR de tu mesa')).toBeInTheDocument();
      });
    });
  });
});
