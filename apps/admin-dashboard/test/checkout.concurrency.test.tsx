import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import CheckoutPage from '../src/app/(panel)/checkout/page';
import { ConfirmPaymentButton } from '../src/components/checkout';
import { ApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('U5: Admin Checkout State Consistency & Concurrency (TDD)', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });

  const activeSessions = [
    {
      sessionId: 'sess-A',
      tenantId: 't-1',
      tableId: 'tbl-A',
      status: 'active',
      createdAt: '2026-10-12T10:00:00.000Z',
      expiresAt: '2026-10-12T12:00:00.000Z',
    },
    {
      sessionId: 'sess-B',
      tenantId: 't-1',
      tableId: 'tbl-B',
      status: 'active',
      createdAt: '2026-10-12T10:15:00.000Z',
      expiresAt: '2026-10-12T12:15:00.000Z',
    },
  ];

  const tables = [
    { tableId: 'tbl-A', tenantId: 't-1', label: 'Mesa Terraza A', status: 'active', createdAt: '2026-01-01' },
    { tableId: 'tbl-B', tenantId: 't-1', label: 'Mesa Salón B', status: 'active', createdAt: '2026-01-01' },
  ];

  const billA = {
    sessionId: 'sess-A',
    tableId: 'tbl-A',
    ordersCount: 1,
    total: 100,
    payment: null,
    orders: [
      {
        id: 'ord-A1',
        tenantId: 't-1',
        sessionId: 'sess-A',
        tableId: 'tbl-A',
        status: 'READY',
        total: 100,
        items: [
          { id: 'it-A1', productId: 'p-1', productName: 'Tacos Pastor', unitPrice: 100, quantity: 1, modifiers: [] },
        ],
        createdAt: '2026-10-12T10:05:00.000Z',
      },
    ],
  };

  const billB = {
    sessionId: 'sess-B',
    tableId: 'tbl-B',
    ordersCount: 1,
    total: 250,
    payment: null,
    orders: [
      {
        id: 'ord-B1',
        tenantId: 't-1',
        sessionId: 'sess-B',
        tableId: 'tbl-B',
        status: 'READY',
        total: 250,
        items: [
          { id: 'it-B1', productId: 'p-2', productName: 'Corte Especial', unitPrice: 250, quantity: 1, modifiers: [] },
        ],
        createdAt: '2026-10-12T10:20:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'admin-jwt-token';
  });

  test('1. Condición de carrera: Selección A -> B donde A responde más tarde NO debe sobreescribir B', async () => {
    let resolveBillA!: (val: any) => void;
    let resolveBillB!: (val: any) => void;

    const promiseA = new Promise((res) => {
      resolveBillA = res;
    });
    const promiseB = new Promise((res) => {
      resolveBillB = res;
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return promiseA;
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return promiseB;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Mesa Salón B')).toBeInTheDocument();
      });

      // 1. Click en Mesa Terraza A (inicia petición A)
      fireEvent.click(screen.getByText('Mesa Terraza A'));

      // 2. Inmediatamente click en Mesa Salón B (inicia petición B)
      fireEvent.click(screen.getByText('Mesa Salón B'));

      // 3. Resuelve B primero
      await act(async () => {
        resolveBillB({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billB,
        });
      });

      // Mesa B debe estar mostrada con su total $250
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
        expect(screen.getAllByText('$250').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Corte Especial')).toBeInTheDocument();
      });

      // 4. Ahora resuelve A tardíamente
      await act(async () => {
        resolveBillA({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billA,
        });
      });

      // Mesa B DEBE seguir visible. A nunca debe sobreescribir B
      expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      expect(screen.getAllByText('$250').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Cuenta — Mesa Terraza A')).not.toBeInTheDocument();
      expect(screen.queryByText('Tacos Pastor')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('2. Error tardío de A no debe mostrarse ni contaminar la vista de B ya cargada', async () => {
    let rejectBillA!: (err: any) => void;
    let resolveBillB!: (val: any) => void;

    const promiseA = new Promise((_, rej) => {
      rejectBillA = rej;
    });
    const promiseB = new Promise((res) => {
      resolveBillB = res;
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return promiseA;
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return promiseB;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Mesa Salón B')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa Terraza A'));
      fireEvent.click(screen.getByText('Mesa Salón B'));

      // Resuelve B exitoso
      await act(async () => {
        resolveBillB({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billB,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      });

      // Rechaza A con error 500 tardío
      await act(async () => {
        rejectBillA(new Error('Network error on session A'));
      });

      // Mesa B sigue sin error
      expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('3. Invalidación de modal al cambiar de sesión: si el modal estaba abierto para A y se cambia a B, el modal se cierra y no permite confirmar B con datos de A', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billA };
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billB };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
      });

      // Cargar mesa A
      fireEvent.click(screen.getByText('Mesa Terraza A'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
      });

      // Seleccionar método de pago
      fireEvent.click(screen.getByRole('radio', { name: /efectivo/i }));

      // Abrir modal de confirmación para A
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(within(screen.getByRole('dialog')).getAllByText('$100').length).toBeGreaterThanOrEqual(1);

      // Cambiar a Mesa B mientras modal estaba abierto
      fireEvent.click(screen.getByText('Mesa Salón B'));

      // El modal de A DEBE cerrarse de inmediato
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Cuando carga B, el botón de registrar cobro debe estar deshabilitado hasta elegir método para B
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      });
      const regBtn = screen.getByRole('button', { name: /registrar cobro/i });
      expect(regBtn).toBeDisabled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('4. Respuesta tardía de cobro previo sobre A no borra ni altera la selección activa de B', async () => {
    let resolveConfirmA!: (val: any) => void;
    const confirmPromiseA = new Promise((res) => {
      resolveConfirmA = res;
    });

    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billA };
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billB };
      }
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        if (body.sessionId === 'sess-A') {
          return confirmPromiseA;
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
      });

      // Seleccionar A y cobrar
      fireEvent.click(screen.getByText('Mesa Terraza A'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('radio', { name: /efectivo/i }));
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar cobro' }));

      // Mientras la confirmación de A sigue pendiente en la red, el usuario selecciona Mesa B
      fireEvent.click(screen.getByText('Mesa Salón B'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      });

      // Ahora responde la confirmación tardía de A
      await act(async () => {
        resolveConfirmA({
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-A',
            sessionId: 'sess-A',
            tableId: 'tbl-A',
            amount: 100,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        });
      });

      // La selección activa de B NO debe haberse borrado ni puesto en null
      expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      expect(screen.getAllByText('$250').length).toBeGreaterThanOrEqual(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('5. Prevención de doble cobro / doble click: el botón queda disabled y en estado pendiente mientras procesa', async () => {
    let resolveConfirm!: (val: any) => void;
    const confirmPromise = new Promise((res) => {
      resolveConfirm = res;
    });

    const originalFetch = global.fetch;
    const postCalls: any[] = [];
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billA };
      }
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        postCalls.push(opts.body);
        return confirmPromise;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa Terraza A'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('radio', { name: /efectivo/i }));
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));

      const dialog = screen.getByRole('dialog');
      const confirmBtn = within(dialog).getByRole('button', { name: 'Confirmar cobro' });

      // Doble click rápido
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      // Solo una llamada a POST
      expect(postCalls.length).toBe(1);

      // Botón principal de cobro debe indicar pendiente/disabled
      const registrarBtn = screen.getByRole('button', { name: /procesando|registrar cobro/i });
      expect(registrarBtn).toBeDisabled();

      // Completar cobro
      await act(async () => {
        resolveConfirm({
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-A',
            sessionId: 'sess-A',
            tableId: 'tbl-A',
            amount: 100,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('6. ConfirmPaymentButton independiente previene doble click y respeta prop loading', async () => {
    const onConfirm = jest.fn();
    const { rerender } = render(
      <ConfirmPaymentButton
        total={100}
        method="CASH"
        loading={true}
        onConfirm={onConfirm}
      />
    );

    const btn = screen.getByRole('button', { name: /procesando|registrar cobro/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');

    // Al estar loading, click no debe abrir modal ni llamar a onConfirm
    fireEvent.click(btn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    // Rerender sin loading
    rerender(
      <ConfirmPaymentButton
        total={100}
        method="CASH"
        loading={false}
        onConfirm={onConfirm}
      />
    );
    const activeBtn = screen.getByRole('button', { name: /registrar cobro/i });
    expect(activeBtn).not.toBeDisabled();
    fireEvent.click(activeBtn);

    const dialog = screen.getByRole('dialog');
    const approveBtn = within(dialog).getByRole('button', { name: 'Confirmar cobro' });

    // Click en aprobar
    await act(async () => {
      fireEvent.click(approveBtn);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('7. Limpieza al desmontar: peticiones tardías no provocan errores ni setState tras unmount', async () => {
    let resolveBill!: (val: any) => void;
    const billPromise = new Promise((res) => {
      resolveBill = res;
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        return billPromise;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      const { unmount } = render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa Terraza A'));

      // Desmontar el componente mientras la petición está en vuelo
      unmount();

      // Resolver la petición luego del unmount
      await act(async () => {
        resolveBill({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billA,
        });
      });

      // No debe haber warnings de React sobre setState en componente desmontado
      const unmountedWarnings = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes("Can't perform a React state update on an unmounted component"))
      );
      expect(unmountedWarnings.length).toBe(0);
    } finally {
      consoleErrorSpy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  test('8. U5-R6: Cambio A -> B -> A invalida respuestas de la primera selección A (generación monotónica)', async () => {
    let resolveBillA1!: (val: any) => void;
    let resolveBillB!: (val: any) => void;
    let resolveBillA2!: (val: any) => void;

    const promiseA1 = new Promise((res) => {
      resolveBillA1 = res;
    });
    const promiseB = new Promise((res) => {
      resolveBillB = res;
    });
    const promiseA2 = new Promise((res) => {
      resolveBillA2 = res;
    });

    const billAUpdated = {
      ...billA,
      total: 180,
      orders: [
        {
          ...billA.orders[0],
          total: 180,
          items: [
            { id: 'it-A2', productId: 'p-3', productName: 'Tacos Gobernador Actualizados', unitPrice: 180, quantity: 1, modifiers: [] },
          ],
        },
      ],
    };

    let aCallCount = 0;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        aCallCount += 1;
        return aCallCount === 1 ? promiseA1 : promiseA2;
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return promiseB;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Mesa Salón B')).toBeInTheDocument();
      });

      // 1. Selección A #1 (inicia promiseA1)
      fireEvent.click(screen.getByText('Mesa Terraza A'));
      // 2. Cambio a B (inicia promiseB)
      fireEvent.click(screen.getByText('Mesa Salón B'));
      // 3. Regreso a A #2 (inicia promiseA2)
      fireEvent.click(screen.getByText('Mesa Terraza A'));

      expect(aCallCount).toBe(2);

      // 4. Resuelve tardíamente la PRIMERA solicitud A1 (obsoleta, $100) mientras A2 sigue en vuelo
      await act(async () => {
        resolveBillA1({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billA,
        });
      });

      // La respuesta vieja A1 NO debe repintar la cuenta ni habilitar confirmar cobro
      expect(screen.queryByText('Tacos Pastor')).not.toBeInTheDocument();
      expect(screen.queryByText('$100')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /registrar cobro/i })).not.toBeInTheDocument();

      // 5. Ahora resuelve A2 (la solicitud vigente, $180)
      await act(async () => {
        resolveBillA2({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billAUpdated,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Tacos Gobernador Actualizados')).toBeInTheDocument();
        expect(screen.getAllByText('$180').length).toBeGreaterThanOrEqual(1);
      });

      // Incluso si B resuelve después, sigue ignorándose
      await act(async () => {
        resolveBillB({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billB,
        });
      });
      expect(screen.getByText('Tacos Gobernador Actualizados')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('9. U5-R6: Fallo de carga de cuenta cuando bill es null muestra alerta visible y permite retry exitoso', async () => {
    let aCallCount = 0;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => activeSessions };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        aCallCount += 1;
        if (aCallCount === 1) {
          throw new Error('Error de red al cargar cuenta');
        }
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billA };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
      });

      // 1. Seleccionar Mesa A -> falla el primer GET con bill === null
      fireEvent.click(screen.getByText('Mesa Terraza A'));

      // Debe mostrarse role="alert" con el mensaje de error y botón de reintentar aunque bill sea null
      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Error de red al cargar cuenta/i);

      const retryBtn = within(alert).getByRole('button', { name: /reintentar/i });
      expect(retryBtn).toBeInTheDocument();

      // 2. Click en Reintentar -> vuelve a pedir la cuenta de Mesa A y ahora resuelve con billA
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Tacos Pastor')).toBeInTheDocument();
        expect(screen.getAllByText('$100').length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(aCallCount).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('10. U5-R7: Éxito tardío de POST de pago A tras cambio A -> B -> A y carga completa de cuenta A invalida la cuenta pagada y no deja habilitado el cobro de un snapshot obsoleto', async () => {
    let resolveConfirmA!: (val: any) => void;
    const confirmPromiseA = new Promise((res) => {
      resolveConfirmA = res;
    });

    let resolveSecondBillA!: (val: any) => void;
    const secondBillAPromise = new Promise((res) => {
      resolveSecondBillA = res;
    });

    let aGetCount = 0;
    let sessionsGetCount = 0;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/tables')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => tables };
      }
      if (urlStr.includes('/v1/sessions?status=active')) {
        sessionsGetCount += 1;
        // Tras el cierre de A, el backend sólo devuelve B como activa
        const list = sessionsGetCount === 1 ? activeSessions : [activeSessions[1]];
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => list };
      }
      if (urlStr.includes('/v1/checkout/sess-A')) {
        aGetCount += 1;
        if (aGetCount === 1) {
          return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billA };
        }
        return secondBillAPromise;
      }
      if (urlStr.includes('/v1/checkout/sess-B')) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => billB };
      }
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        if (body.sessionId === 'sess-A') {
          return confirmPromiseA;
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa Terraza A')).toBeInTheDocument();
        expect(screen.getByText('Mesa Salón B')).toBeInTheDocument();
      });

      // 1. Seleccionar Mesa A (gen 1), elegir método y confirmar pago (POST de A queda en vuelo)
      fireEvent.click(screen.getByText('Mesa Terraza A'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('radio', { name: /efectivo/i }));
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar cobro' }));

      // 2. Mientras POST de A está en vuelo, cambiar a B (gen 2) y volver a A (gen 3)
      fireEvent.click(screen.getByText('Mesa Salón B'));
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Salón B')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa Terraza A'));
      expect(aGetCount).toBe(2);

      // 3. Completar el segundo GET de A (gen 3) ANTES de que resuelva el POST de pago A
      await act(async () => {
        resolveSecondBillA({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => billA,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa Terraza A')).toBeInTheDocument();
      });
      // Incluso si el operador selecciona un método de pago mientras POST A aún no termina
      fireEvent.click(screen.getByRole('radio', { name: /efectivo/i }));

      // 4. Ahora resuelve con éxito el POST de pago de la sesión A
      await act(async () => {
        resolveConfirmA({
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-A',
            sessionId: 'sess-A',
            tableId: 'tbl-A',
            amount: 100,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        });
      });

      // 5. La cuenta de A ya pagada NO debe quedar vigente ni con botón habilitado para re-cobrar el snapshot obsoleto
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Cuenta — Mesa Terraza A')).not.toBeInTheDocument();
      expect(screen.queryByText('Tacos Pastor')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /registrar cobro/i })).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
