import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WaiterTerminalPage from '../src/app/(panel)/meseros/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

describe('Terminal de Meseros - Flujo Guiado en 3 Pasos (V27 / REF-5 / N02c)', () => {
  const originalFetch = global.fetch;

  const sampleZones = [
    { id: 'zone-terraza', name: 'Terraza', sortOrder: 1, active: true },
    { id: 'zone-salon', name: 'Salón Principal', sortOrder: 2, active: true },
  ];

  const sampleTables = [
    {
      tableId: 'tbl-1',
      label: '1',
      capacity: 4,
      zoneId: 'zone-terraza',
      status: 'AVAILABLE' as const,
    },
    {
      tableId: 'tbl-2',
      label: '2',
      capacity: 2,
      zoneId: 'zone-salon',
      status: 'AVAILABLE' as const,
    },
    {
      tableId: 'tbl-3',
      label: '3',
      capacity: 6,
      zoneId: 'zone-salon',
      status: 'AVAILABLE' as const,
    },
  ];

  const sampleActiveSessions = [
    { sessionId: 'sess-occ-2', tableId: 'tbl-2', status: 'active' },
  ];

  const sampleReservations = [
    { id: 'res-3', tableId: 'tbl-3', status: 'active', customerName: 'Carlos M.' },
  ];

  const sampleMenuCategories = [
    { id: 'cat-1', name: 'Platos Fuertes', sortOrder: 1 },
    { id: 'cat-2', name: 'Bebidas', sortOrder: 2 },
  ];

  const sampleMenuProducts = [
    {
      id: 'prod-1',
      name: 'Hamburguesa Clásica',
      description: 'Carne de res 180g con papas',
      price: 25000,
      isAvailable: true,
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Platos Fuertes' },
    },
    {
      id: 'prod-2',
      name: 'Cerveza Artesanal',
      description: 'Botella 330ml rubia',
      price: 12000,
      isAvailable: false, // AGOTADO
      categoryId: 'cat-2',
      category: { id: 'cat-2', name: 'Bebidas' },
    },
    {
      id: 'prod-3',
      name: 'Limonada de Coco',
      description: 'Bebida refrescante natural',
      price: 10000,
      isAvailable: true,
      categoryId: 'cat-2',
      category: { id: 'cat-2', name: 'Bebidas' },
    },
  ];

  let capturedRequests: Array<{ url: string; method: string; headers: any; body: any }> = [];

  function setupFetch(customSettings?: { operatingMode?: string }) {
    capturedRequests = [];
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      const method = opts?.method || 'GET';
      const headers = opts?.headers || {};
      let body = null;
      if (opts?.body) {
        try {
          body = JSON.parse(opts.body);
        } catch {
          body = opts.body;
        }
      }

      capturedRequests.push({ url: urlStr, method, headers, body });

      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleTables,
        };
      }

      if (urlStr.includes('/v1/zones')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleZones,
        };
      }

      if (urlStr.includes('/v1/tenant/settings')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            operatingMode: customSettings?.operatingMode || 'hybrid',
            estimatedPrepMinutes: 18,
          }),
        };
      }

      if (urlStr.includes('/v1/sessions?status=active')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleActiveSessions,
        };
      }

      if (urlStr.includes('/v1/reservations')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleReservations,
        };
      }

      if (urlStr.includes('/v1/graphql') && method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: sampleMenuCategories,
              products: sampleMenuProducts,
            },
          }),
        };
      }

      if (urlStr.includes('/v1/sessions/staff-open') && method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            session: {
              sessionId: 'sess-waiter-101',
              tableId: body?.tableId,
              status: 'active',
            },
          }),
        };
      }

      if (urlStr.includes('/v1/cart/items') && method === 'POST') {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            items: [
              {
                cartItemId: 'ci-1',
                productId: body?.productId,
                quantity: body?.quantity,
                notes: body?.notes,
              },
            ],
          }),
        };
      }

      if (urlStr.includes('/v1/cart/confirm') && method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            order: {
              id: 'ord-waiter-999',
              tableId: body?.tableId,
              status: 'PLACED',
              notes: body?.notes,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    }) as any;
  }

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-waiter-staff-jwt-token';
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('1. Paso 1: Grid con mesas configuradas, número, capacidad, zona y chips de estado pastel (Libre, Ocupada, Reservada)', async () => {
    setupFetch({ operatingMode: 'hybrid' });
    render(<WaiterTerminalPage />);

    // Esperar a que cargue la lista de mesas
    await waitFor(() => {
      expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
    expect(screen.getByText('Mesa 3')).toBeInTheDocument();

    // Capacidades y zonas visibles
    expect(screen.getByText('4 puestos • Terraza')).toBeInTheDocument();
    expect(screen.getByText('2 puestos • Salón Principal')).toBeInTheDocument();
    expect(screen.getByText('6 puestos • Salón Principal')).toBeInTheDocument();

    // Chips de estado pastel (Mesa 1 libre, Mesa 2 ocupada por sesión activa, Mesa 3 reservada)
    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Reservada')).toBeInTheDocument();

    // Modo de operación visible
    expect(screen.getByTestId('operating-mode-badge')).toHaveTextContent('Modo: Híbrido');
  });

  test('2. Selección de mesa invoca staffOpenSession (POST /v1/sessions/staff-open) y avanza a Paso 2', async () => {
    setupFetch({ operatingMode: 'hybrid' });
    render(<WaiterTerminalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('table-card-tbl-1')).toBeInTheDocument();
    });

    // Clic en Mesa 1
    fireEvent.click(screen.getByTestId('table-card-tbl-1'));

    // Debe llamar a POST /v1/sessions/staff-open con { tableId: 'tbl-1' }
    await waitFor(() => {
      const openReq = capturedRequests.find(
        (r) => r.url.includes('/v1/sessions/staff-open') && r.method === 'POST'
      );
      expect(openReq).toBeDefined();
      expect(openReq?.body).toEqual({ tableId: 'tbl-1' });
    });

    // Debe avanzar al Paso 2
    await waitFor(() => {
      expect(screen.getByTestId('step-2-menu')).toBeInTheDocument();
      expect(screen.getByText(/Mesa 1 \(Terraza • 4 puestos\)/i)).toBeInTheDocument();
    });
  });

  test('3. Paso 2: Productos disponibles seleccionables; agotados deshabilitados', async () => {
    setupFetch({ operatingMode: 'hybrid' });
    render(<WaiterTerminalPage />);

    // Seleccionar mesa 1 para ir a Paso 2
    await waitFor(() => screen.getByTestId('table-card-tbl-1'));
    fireEvent.click(screen.getByTestId('table-card-tbl-1'));

    await waitFor(() => screen.getByTestId('step-2-menu'));

    // Producto disponible: Hamburguesa Clásica ($25.000)
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument();
    const btnAddHamburguesa = screen.getByTestId('btn-add-product-prod-1');
    expect(btnAddHamburguesa).toBeEnabled();
    expect(btnAddHamburguesa).not.toHaveAttribute('aria-disabled', 'true');

    // Producto agotado: Cerveza Artesanal (isAvailable: false)
    expect(screen.getByText('Cerveza Artesanal')).toBeInTheDocument();
    expect(screen.getByTestId('badge-agotado-prod-2')).toHaveTextContent('Agotado');
    const btnAddCerveza = screen.getByTestId('btn-add-product-prod-2');
    expect(btnAddCerveza).toBeDisabled();
    expect(btnAddCerveza).toHaveAttribute('aria-disabled', 'true');

    // Clic en producto agotado no agrega nada al carrito
    fireEvent.click(btnAddCerveza);

    // Revisar botón de resumen: debe seguir deshabilitado porque el carrito está vacío
    const btnReview = screen.getByText(/Revisar Pedido/i);
    expect(btnReview).toBeDisabled();
  });

  test('4. Paso 2: Permite ingresar notas por ítem y agregar al pedido temporal', async () => {
    setupFetch({ operatingMode: 'hybrid' });
    render(<WaiterTerminalPage />);

    await waitFor(() => screen.getByTestId('table-card-tbl-1'));
    fireEvent.click(screen.getByTestId('table-card-tbl-1'));

    await waitFor(() => screen.getByTestId('step-2-menu'));

    // Ingresar nota individual para la hamburguesa
    const noteInputHamburguesa = screen.getByTestId('item-note-input-prod-1');
    fireEvent.change(noteInputHamburguesa, { target: { value: 'Término medio, sin cebolla' } });

    // Agregar al pedido temporal
    fireEvent.click(screen.getByTestId('btn-add-product-prod-1'));

    // Ahora el botón de revisar pedido está habilitado y muestra 1 ítem y $ 25.000
    const btnReview = screen.getByText(/Revisar Pedido/i);
    expect(btnReview).toBeEnabled();
    expect(btnReview).toHaveTextContent('1 ítems');
    expect(btnReview).toHaveTextContent('$ 25.000');
  });

  test('5. Paso 3: Revisión de pedido, edición de nota por ítem, otras solicitudes generales y Enviar a Cocina con x-session-id', async () => {
    setupFetch({ operatingMode: 'hybrid' });
    render(<WaiterTerminalPage />);

    // 1. Seleccionar mesa
    await waitFor(() => screen.getByTestId('table-card-tbl-1'));
    fireEvent.click(screen.getByTestId('table-card-tbl-1'));

    // 2. Agregar ítem con nota
    await waitFor(() => screen.getByTestId('step-2-menu'));
    const noteInput = screen.getByTestId('item-note-input-prod-1');
    fireEvent.change(noteInput, { target: { value: 'Término medio' } });
    fireEvent.click(screen.getByTestId('btn-add-product-prod-1'));

    // Avanzar a Paso 3 (Revisión)
    const btnReview = screen.getByText(/Revisar Pedido/i);
    fireEvent.click(btnReview);

    await waitFor(() => {
      expect(screen.getByTestId('step-3-review')).toBeInTheDocument();
    });

    // Verificar ítem en lista de revisión con su nota editable
    const itemNoteReview = screen.getByPlaceholderText(/Nota de preparación \(ej: sin cebolla, término medio\)/i);
    expect(itemNoteReview).toHaveValue('Término medio');

    // Modificar nota del ítem en revisión
    fireEvent.change(itemNoteReview, { target: { value: 'Término tres cuartos' } });
    expect(itemNoteReview).toHaveValue('Término tres cuartos');

    // Ingresar "Otras solicitudes" generales (<= 280 caracteres)
    const generalNotesTextarea = screen.getByTestId('general-notes-textarea');
    fireEvent.change(generalNotesTextarea, {
      target: { value: 'Mesa al fondo. Traer platos hondos y servir entradas primero.' },
    });
    expect(screen.getByText(/61 \/ 280/)).toBeInTheDocument();

    // Total en COP
    expect(screen.getByTestId('order-total-cop')).toHaveTextContent('$ 25.000');

    // Botón Enviar a Cocina
    const btnSend = screen.getByTestId('btn-send-to-kitchen');
    expect(btnSend).toBeEnabled();
    fireEvent.click(btnSend);

    // Verificar llamadas de red con x-session-id
    await waitFor(() => {
      // 1. addWaiterCartItem envía x-session-id y nota del ítem
      const itemReq = capturedRequests.find(
        (r) => r.url.includes('/v1/cart/items') && r.method === 'POST'
      );
      expect(itemReq).toBeDefined();
      expect(itemReq?.headers['x-session-id']).toBe('sess-waiter-101');
      expect(itemReq?.body.notes).toBe('Término tres cuartos');
      expect(itemReq?.body.productId).toBe('prod-1');

      // 2. confirmWaiterOrder envía x-session-id y notas generales
      const confirmReq = capturedRequests.find(
        (r) => r.url.includes('/v1/cart/confirm') && r.method === 'POST'
      );
      expect(confirmReq).toBeDefined();
      expect(confirmReq?.headers['x-session-id']).toBe('sess-waiter-101');
      expect(confirmReq?.body.tableId).toBe('tbl-1');
      expect(confirmReq?.body.notes).toBe(
        'Mesa al fondo. Traer platos hondos y servir entradas primero.'
      );
    });

    // Feedback visible de éxito
    await waitFor(() => {
      const feedback = screen.getByTestId('order-success-feedback');
      expect(feedback).toBeInTheDocument();
      expect(feedback).toHaveTextContent('Pedido enviado a cocina para Mesa 1');
    });

    // Botón "Atender otra mesa" regresa al Paso 1
    const btnNewOrder = screen.getByRole('button', { name: /Atender otra mesa/i });
    fireEvent.click(btnNewOrder);

    await waitFor(() => {
      expect(screen.getByTestId('step-1-tables')).toBeInTheDocument();
    });
  });

  test('6. Funciona y está habilitada TANTO en modo hybrid como en modo waiter_only', async () => {
    // Configurado en modo waiter_only
    setupFetch({ operatingMode: 'waiter_only' });
    render(<WaiterTerminalPage />);

    await waitFor(() => {
      expect(screen.getByTestId('operating-mode-badge')).toHaveTextContent('Modo: Solo Meseros');
    });

    // La terminal de meseros sigue estando 100% activa
    const tableCard = screen.getByTestId('table-card-tbl-1');
    expect(tableCard).toBeEnabled();
    fireEvent.click(tableCard);

    await waitFor(() => {
      expect(screen.getByTestId('step-2-menu')).toBeInTheDocument();
    });
  });
});
