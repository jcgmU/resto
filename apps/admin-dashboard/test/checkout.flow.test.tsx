import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import CheckoutPage from '../src/app/(panel)/checkout/page';
import { ApiClient } from '../src/lib/api';
import * as realtimeModule from '../src/lib/realtime';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('RONDA 5: FIX B1 - Admin Checkout Cableado Real (TDD Rojo)', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'admin-jwt-token';
  });

  test('CheckoutPage carga sesiones activas al montar, obtiene cuenta al seleccionar mesa y registra pago en confirmación', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      // 1. GET /v1/sessions
      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-active-1',
              tenantId: 't-1',
              tableId: 'Mesa 10',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      // 2. GET /v1/checkout/sess-active-1
      if (urlStr.includes('/v1/checkout/sess-active-1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-active-1',
            tableId: 'Mesa 10',
            ordersCount: 1,
            total: 1500,
            payment: null,
            orders: [],
          }),
        };
      }

      // 3. POST /v1/checkout/confirm
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        expect(body.sessionId).toBe('sess-active-1');
        expect(body.tableId).toBe('Mesa 10');
        expect(body.method).toBe('CASH');

        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-real-1',
            sessionId: 'sess-active-1',
            tableId: 'Mesa 10',
            amount: 1500,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        };
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

      // Debe consultar sesiones activas y mostrar la mesa
      await waitFor(() => {
        expect(screen.getByText('Mesa 10')).toBeInTheDocument();
      });

      // Seleccionar la mesa
      fireEvent.click(screen.getByText('Mesa 10'));

      // Debe cargar el bill y mostrar el total
      await waitFor(() => {
        expect(screen.getByText(/Total a Cobrar/i)).toBeInTheDocument();
        expect(screen.getByText(/\$\s*1\.500/i)).toBeInTheDocument();
      });

      // Seleccionar método de pago Efectivo
      const cashBtn = screen.getByRole('radio', { name: /efectivo/i });
      fireEvent.click(cashBtn);

      // Confirmar pago (click abre ModalConfirm obligatorio)
      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/cuenta actual/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/total a cobrar/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/método/i)).toBeInTheDocument();
      expect(within(dialog).getByText('Efectivo')).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: 'Confirmar cobro' });
      fireEvent.click(confirmBtn);

      // Debe mostrar tarjeta de éxito
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Tratamiento de error SESSION_CLOSE_FAILED ofrece reintento y al reintentar completa el cobro', async () => {
    let attempt = 0;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-active-fail',
              tenantId: 't-1',
              tableId: 'Mesa 5',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-active-fail')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-active-fail',
            tableId: 'Mesa 5',
            ordersCount: 1,
            total: 200,
            payment: null,
            orders: [],
          }),
        };
      }

      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        attempt += 1;
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({
              code: 'SESSION_CLOSE_FAILED',
              message: 'SESSION_CLOSE_FAILED',
            }),
          };
        }
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-retry-1',
            sessionId: 'sess-active-fail',
            tableId: 'Mesa 5',
            amount: 200,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        };
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
        expect(screen.getByText('Mesa 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 5'));

      await waitFor(() => {
        expect(screen.getByText(/\$\s*200/i)).toBeInTheDocument();
      });

      const cashBtn = screen.getByRole('radio', { name: /efectivo/i });
      fireEvent.click(cashBtn);

      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const confirmBtn = screen.getByRole('button', { name: 'Confirmar cobro' });
      fireEvent.click(confirmBtn);

      // Debe mostrar alerta de error SESSION_CLOSE_FAILED y botón Reintentar cierre
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reintentar cierre/i })).toBeInTheDocument();
      });

      // Click en Reintentar cierre
      const retryBtn = screen.getByRole('button', { name: /reintentar cierre/i });
      fireEvent.click(retryBtn);

      // Segundo intento tiene éxito
      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('H9: Flujo completo con GET /v1/tables — resuelve nombres de mesa, distingue sesiones gemelas y muestra métodos en español', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      // GET /v1/tables
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              tableId: 'tbl-vip-77',
              tenantId: 't-1',
              label: 'Mesa VIP 77',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }

      // GET /v1/sessions: dos sesiones en la misma mesa (sesiones gemelas)
      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-gemela-111111',
              tenantId: 't-1',
              tableId: 'tbl-vip-77',
              status: 'active',
              createdAt: '2026-10-11T12:00:00.000Z',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            {
              sessionId: 'sess-gemela-222222',
              tenantId: 't-1',
              tableId: 'tbl-vip-77',
              status: 'active',
              createdAt: '2026-10-11T13:30:00.000Z',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      // GET /v1/checkout/sess-gemela-111111
      if (urlStr.includes('/v1/checkout/sess-gemela-111111')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-gemela-111111',
            tableId: 'tbl-vip-77',
            ordersCount: 1,
            total: 3500,
            payment: null,
            orders: [
              {
                id: 'order-33334444',
                tenantId: 't-1',
                sessionId: 'sess-gemela-111111',
                tableId: 'tbl-vip-77',
                status: 'READY',
                total: 3500,
                items: [
                  {
                    id: 'it-1',
                    productId: 'p-1',
                    productName: 'Asado Especial',
                    unitPrice: 3500,
                    quantity: 1,
                    modifiers: [],
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        };
      }

      // POST /v1/checkout/confirm
      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            paymentId: 'pay-cash-1',
            sessionId: 'sess-gemela-111111',
            tableId: 'tbl-vip-77',
            amount: 3500,
            method: 'CASH',
            status: 'COMPLETED',
          }),
        };
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

      // (a) Nombre de mesa resuelto con getTableDisplayName
      await waitFor(() => {
        const vipHeaders = screen.getAllByText('Mesa VIP 77');
        expect(vipHeaders).toHaveLength(2);
      });

      // (b) Sesiones gemelas son distinguibles en la grilla
      expect(screen.getByText(/Sesión #111111/i)).toBeInTheDocument();
      expect(screen.getByText(/Sesión #222222/i)).toBeInTheDocument();

      // Seleccionar la primera sesión
      fireEvent.click(screen.getByText(/Sesión #111111/i));

      // Resumen de cuenta muestra el nombre real y formato de orden
      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa VIP 77')).toBeInTheDocument();
        expect(screen.getByText(/Orden #334444/i)).toBeInTheDocument();
      });

      // (c) Elegir Efectivo
      const cashRadio = screen.getByRole('radio', { name: 'Efectivo' });
      fireEvent.click(cashRadio);

      // Confirmar cobro
      fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Efectivo')).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cobro' }));

      // Tarjeta de éxito muestra nombre real y método en español
      await waitFor(() => {
        expect(screen.getByText(/Mesa VIP 77 • Total:\s*\$\s*3\.500\s*• Medio:\s*Efectivo/i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('V12 (a): Cobro CASH con respuesta backend anidada { bill, payment } envía monto y registra confirmación', async () => {
    const originalFetch = global.fetch;
    let confirmBody: any = null;

    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-cash-nested',
              tenantId: 't-1',
              tableId: 'Mesa 8',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-cash-nested')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            bill: {
              sessionId: 'sess-cash-nested',
              tableId: 'Mesa 8',
              ordersCount: 1,
              total: 5400,
              payment: null,
              orders: [],
            },
          }),
        };
      }

      if (urlStr.includes('/v1/checkout/confirm') && opts?.method === 'POST') {
        confirmBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            bill: {
              sessionId: 'sess-cash-nested',
              tableId: 'Mesa 8',
              total: 5400,
              ordersCount: 1,
              orders: [],
            },
            payment: {
              id: 'pay-nested-8',
              amount: 5400,
              method: 'CASH',
              status: 'COMPLETED',
            },
          }),
        };
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
        expect(screen.getByText('Mesa 8')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 8'));

      await waitFor(() => {
        expect(screen.getByText(/\$\s*5\.400/i)).toBeInTheDocument();
      });

      const cashRadio = screen.getByRole('radio', { name: /efectivo/i });
      fireEvent.click(cashRadio);

      const registrarBtn = screen.getByRole('button', { name: /registrar cobro/i });
      fireEvent.click(registrarBtn);

      const dialog = screen.getByRole('dialog');
      const confirmBtn = within(dialog).getByRole('button', { name: 'Confirmar cobro' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/cobro registrado\. mesa liberada\./i)).toBeInTheDocument();
        expect(screen.getByText(/\$\s*5\.400/i)).toBeInTheDocument();
      });

      expect(confirmBody).toEqual({
        sessionId: 'sess-cash-nested',
        tableId: 'Mesa 8',
        method: 'CASH',
        amount: 5400,
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('V12 (b): Error con respuesta anidada { error: { code, message } } (ej. BILL_EMPTY) visible fuera de bill && con botón de reintento', async () => {
    let attempt = 0;
    const originalFetch = global.fetch;

    const fetchMock = jest.fn(async (url: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-empty-1',
              tenantId: 't-1',
              tableId: 'Mesa 12',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-empty-1')) {
        attempt += 1;
        if (attempt === 1) {
          return {
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({
              error: {
                code: 'BILL_EMPTY',
                message: 'No hay pedidos activos',
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-empty-1',
            tableId: 'Mesa 12',
            ordersCount: 1,
            total: 100,
            payment: null,
            orders: [],
          }),
        };
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
        expect(screen.getByText('Mesa 12')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 12'));

      // Error banner fuera de bill && debe ser visible
      await waitFor(() => {
        const errorBanner = screen.getByTestId('bill-error-banner');
        expect(errorBanner).toBeInTheDocument();
        expect(within(errorBanner).getByText(/BILL_EMPTY/i)).toBeInTheDocument();
        expect(within(errorBanner).getByText(/la mesa no tiene pedidos registrados para cobrar/i)).toBeInTheDocument();
        expect(within(errorBanner).getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
      });

      // Click en Reintentar
      const retryBtn = within(screen.getByTestId('bill-error-banner')).getByRole('button', { name: /reintentar/i });
      fireEvent.click(retryBtn);

      // Segundo intento carga exitosamente la cuenta
      await waitFor(() => {
        expect(screen.getByText(/\$\s*100/i)).toBeInTheDocument();
        expect(screen.queryByTestId('bill-error-banner')).not.toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('V12 (c): Política N16: Liberar mesa bloqueada cuando hay consumo pendiente sin pagar', async () => {
    const originalFetch = global.fetch;

    const fetchMock = jest.fn(async (url: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-pending-1',
              tenantId: 't-1',
              tableId: 'Mesa 15',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-pending-1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-pending-1',
            tableId: 'Mesa 15',
            ordersCount: 2,
            total: 7800,
            payment: null,
            orders: [],
          }),
        };
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
        expect(screen.getByText('Mesa 15')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 15'));

      await waitFor(() => {
        expect(screen.getByText(/\$\s*7\.800/i)).toBeInTheDocument();
      });

      // Botón "Liberar mesa"
      const releaseBtn = screen.getByRole('button', { name: /liberar mesa/i });
      fireEvent.click(releaseBtn);

      // Modal N16 se abre
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Debe indicar Acción bloqueada y mostrar el saldo pendiente
      expect(within(dialog).getByText(/acción bloqueada/i)).toBeInTheDocument();
      expect(within(dialog).getAllByText(/\$\s*7\.800/i).length).toBeGreaterThanOrEqual(1);

      // Botón de confirmación debe estar estrictamente BLOQUEADO (disabled)
      const confirmReleaseBtn = within(dialog).getByRole('button', { name: /confirmar liberación/i });
      expect(confirmReleaseBtn).toBeDisabled();

      // Cerrar modal
      const cancelBtn = within(dialog).getByRole('button', { name: /cancelar/i });
      fireEvent.click(cancelBtn);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('V12 (d): Política N16: Liberar mesa permitida cuando no hay saldo pendiente ($0) y cierra sesión exitosamente', async () => {
    let closedSessionCalled = false;
    const originalFetch = global.fetch;

    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-free-1',
              tenantId: 't-1',
              tableId: 'Mesa 20',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-free-1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-free-1',
            tableId: 'Mesa 20',
            ordersCount: 0,
            total: 0,
            payment: null,
            orders: [],
          }),
        };
      }

      if (urlStr.includes('/v1/sessions/sess-free-1/close') && opts?.method === 'PATCH') {
        closedSessionCalled = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-free-1',
            status: 'closed',
            closedAt: new Date().toISOString(),
          }),
        };
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
        expect(screen.getByText('Mesa 20')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 20'));

      await waitFor(() => {
        expect(screen.getByText(/\$\s*0/i)).toBeInTheDocument();
      });

      // Click en Liberar mesa
      const releaseBtn = screen.getByRole('button', { name: /liberar mesa/i });
      fireEvent.click(releaseBtn);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/está al día/i)).toBeInTheDocument();

      // Botón debe estar HABILITADO
      const confirmReleaseBtn = within(dialog).getByRole('button', { name: /confirmar liberación/i });
      expect(confirmReleaseBtn).not.toBeDisabled();

      fireEvent.click(confirmReleaseBtn);

      await waitFor(() => {
        expect(closedSessionCalled).toBe(true);
        expect(screen.getByText(/mesa liberada exitosamente\./i)).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U21: con respuesta que contiene sesiones active, billRequested y closed, la lista muestra active y billRequested pero no closed, y se puede abrir la cuenta de billRequested', async () => {
    const originalFetch = global.fetch;
    const requestedUrls: string[] = [];
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-active-1',
              tenantId: 't-1',
              tableId: 'Mesa 1',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            {
              sessionId: 'sess-bill-req-2',
              tenantId: 't-1',
              tableId: 'Mesa 2',
              status: 'billRequested',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
            {
              sessionId: 'sess-closed-3',
              tenantId: 't-1',
              tableId: 'Mesa 3',
              status: 'closed',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-bill-req-2')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            sessionId: 'sess-bill-req-2',
            tableId: 'Mesa 2',
            ordersCount: 1,
            total: 35000,
            payment: null,
            orders: [
              {
                id: 'ord-bill-1',
                status: 'DELIVERED',
                total: 35000,
                items: [
                  {
                    id: 'it-1',
                    productName: 'Bandeja Paisa',
                    unitPrice: 35000,
                    quantity: 1,
                  },
                ],
              },
            ],
          }),
        };
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

      // Debe consultar sesiones y mostrar Mesa 1 y Mesa 2, pero NO Mesa 3
      await waitFor(() => {
        expect(screen.getByText('Mesa 1')).toBeInTheDocument();
        expect(screen.getByText('Mesa 2')).toBeInTheDocument();
      });
      expect(screen.queryByText('Mesa 3')).not.toBeInTheDocument();

      // La petición debió hacerse a /v1/sessions sin ?status=active
      const sessionsCall = requestedUrls.find((u) => u.includes('/v1/sessions'));
      expect(sessionsCall).toBeDefined();
      expect(sessionsCall).not.toContain('status=active');

      // Se puede abrir la cuenta de la mesa billRequested (Mesa 2)
      fireEvent.click(screen.getByText('Mesa 2'));

      await waitFor(() => {
        expect(screen.getByText('Cuenta — Mesa 2')).toBeInTheDocument();
        expect(screen.getByText('Bandeja Paisa')).toBeInTheDocument();
      });
      expect(screen.getAllByText(/35\.000/).length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('R2: Checkout muestra estado vacío "Mesa sin consumo" con acción "Liberar mesa" ante 404 BILL_NOT_FOUND', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/sessions') && !urlStr.includes('/close')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-sin-pedidos',
              tenantId: 't-1',
              tableId: 'Mesa 5',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }

      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [{ tableId: 'Mesa 5', label: 'Mesa 5' }],
        };
      }

      if (urlStr.includes('/v1/checkout/sess-sin-pedidos')) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => 'application/json' },
          json: async () => ({
            error: {
              code: 'BILL_NOT_FOUND',
              message: 'No active bill found for session sess-sin-pedidos',
            },
          }),
        };
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
        expect(screen.getByText('Mesa 5')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mesa 5'));

      // Debe mostrar estado vacío "Mesa sin consumo" con botón "Liberar mesa"
      await waitFor(() => {
        expect(screen.getByTestId('bill-empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Mesa sin consumo')).toBeInTheDocument();
      expect(screen.getByText(/no tiene pedidos registrados para cobrar/i)).toBeInTheDocument();
      expect(screen.queryByTestId('bill-error-banner')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Liberar mesa/i })).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('H-A2: CheckoutPage se refresca automáticamente cuando recibe eventos socket table:status-changed o session:checkout-completed', async () => {
    const originalFetch = global.fetch;
    const socketListeners: Record<string, () => void> = {};
    const mockSocket = {
      on: jest.fn((evt: string, cb: () => void) => {
        socketListeners[evt] = cb;
      }),
      off: jest.fn(),
      disconnect: jest.fn(),
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    let fetchCount = 0;
    const fetchMock = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/sessions')) {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [
            {
              sessionId: 'sess-socket-1',
              tenantId: 't-1',
              tableId: 'Mesa 1',
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          ],
        };
      }
      if (urlStr.includes('/v1/tables')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [{ tableId: 'Mesa 1', label: 'Mesa 1' }],
        };
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
        expect(screen.getByText('Mesa 1')).toBeInTheDocument();
      });

      const initialFetchCount = fetchCount;
      expect(initialFetchCount).toBeGreaterThan(0);
      expect(typeof socketListeners['table:status-changed']).toBe('function');
      expect(typeof socketListeners['session:checkout-completed']).toBe('function');

      // Disparar evento de socket table:status-changed
      await act(async () => {
        socketListeners['table:status-changed']();
      });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });

      const afterFirstEvent = fetchCount;
      // Disparar evento de socket session:checkout-completed
      await act(async () => {
        socketListeners['session:checkout-completed']();
      });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(afterFirstEvent);
      });
    } finally {
      socketSpy.mockRestore();
      global.fetch = originalFetch;
    }
  });
});

