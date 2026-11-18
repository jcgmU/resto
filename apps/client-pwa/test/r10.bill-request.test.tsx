import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('R10 / V14: PWA Pagar / Pedir Cuenta (ADR ciclo-sesión)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'guest-jwt-token-r10';
    PwaApiClient.session = {
      sessionId: 'sess-test-r10',
      tenantId: 'tenant-resto-1',
      tableId: 'Mesa 5',
      status: 'active',
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    PwaApiClient.clearAuth();
  });

  test('1. No existe botón ni acción de "Pagar" para el cliente/guest (el cobro es potestad de caja/staff)', () => {
    // Probamos con flag payments activa y desactivada
    for (const flagValue of [false, true]) {
      const provider = new StaticFeatureFlagProvider({ payments: flagValue });
      const { unmount } = render(
        <FeatureFlagProviderRoot provider={provider}>
          <ClientMenuPage params={{ tenantId: 'tenant-resto-1', tableId: 'Mesa 5' }} />
        </FeatureFlagProviderRoot>
      );

      // Nunca debe existir botón "Pagar" ni texto de pago directo
      expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/^pagar$/i)).not.toBeInTheDocument();

      // Debe existir el botón "Pedir la cuenta"
      expect(screen.getByRole('button', { name: /pedir la cuenta/i })).toBeInTheDocument();

      unmount();
    }
  });

  test('2. Flujo de "Pedir la cuenta": llama a POST /v1/sessions/:id/bill-request y muestra estados visibles', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: any = {};
    let resolveBillRequest: (val: any) => void;
    const billRequestPromise = new Promise((resolve) => {
      resolveBillRequest = resolve;
    });

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: { categories: [], products: [] } }),
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

      if (urlStr.includes('/bill-request')) {
        capturedUrl = urlStr;
        capturedMethod = opts?.method;
        capturedHeaders = opts?.headers;
        await billRequestPromise;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'sess-test-r10',
            tenantId: 'tenant-resto-1',
            tableId: 'Mesa 5',
            status: 'billRequested',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<ClientMenuPage params={{ tenantId: 'tenant-resto-1', tableId: 'Mesa 5' }} />);

    // Botón inicial
    const btn = screen.getByRole('button', { name: /pedir la cuenta/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    // Clic en pedir la cuenta
    fireEvent.click(btn);

    // Estado visible mientras está solicitando: "Solicitando cuenta..." y spinner
    expect(screen.getByText('Solicitando cuenta...')).toBeInTheDocument();
    expect(screen.getByTestId('bill-request-spinner')).toBeInTheDocument();
    expect(btn).toBeDisabled();

    // Resolvemos la respuesta del backend
    resolveBillRequest!({});

    // Estado visible de confirmación / ok
    await waitFor(() => {
      expect(
        screen.getByText('Cuenta pedida. Un mesero se acercará con la cuenta')
      ).toBeInTheDocument();
    });

    // Verificamos URL llamada y headers
    expect(capturedUrl).toContain('/v1/sessions/sess-test-r10/bill-request');
    expect(capturedMethod).toBe('POST');
    expect(capturedHeaders?.Authorization).toBe('Bearer guest-jwt-token-r10');

    // StatusChip visible en banner
    const chip = screen.getByTestId('bill-status-chip');
    expect(chip).toHaveTextContent(/cuenta solicitada/i);

    // En footer se refleja claramente el estado pedido y no permite duplicar
    const footerBtn = screen.getByRole('button', { name: /cuenta pedida/i });
    expect(footerBtn).toBeDisabled();
  });

  test('3. En caso de error, muestra mensaje comprensible y botón para reintentar', async () => {
    let callAttempts = 0;

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: { categories: [], products: [] } }),
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

      if (urlStr.includes('/bill-request')) {
        callAttempts++;
        if (callAttempts === 1) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Error temporal en caja' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'sess-test-r10',
            status: 'billRequested',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<ClientMenuPage params={{ tenantId: 'tenant-resto-1', tableId: 'Mesa 5' }} />);

    const btn = screen.getByRole('button', { name: /pedir la cuenta/i });
    fireEvent.click(btn);

    // Muestra alerta con mensaje comprensible
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/error/i);

    // Botón reintentar dentro de la alerta
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    expect(retryBtn).toBeInTheDocument();

    // Pulsar reintentar
    fireEvent.click(retryBtn);

    // Segundo intento exitoso
    await waitFor(() => {
      expect(
        screen.getByText('Cuenta pedida. Un mesero se acercará con la cuenta')
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(callAttempts).toBe(2);
  });

  test('4. Si la sesión ya estaba en estado billRequested, refleja ese estado de inmediato', () => {
    PwaApiClient.session = {
      sessionId: 'sess-test-r10',
      tenantId: 'tenant-resto-1',
      tableId: 'Mesa 5',
      status: 'billRequested',
    };

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: { categories: [], products: [] } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    render(<ClientMenuPage params={{ tenantId: 'tenant-resto-1', tableId: 'Mesa 5' }} />);

    expect(
      screen.getByText('Cuenta pedida. Un mesero se acercará con la cuenta')
    ).toBeInTheDocument();
    expect(screen.getByTestId('bill-status-chip')).toHaveTextContent(/cuenta solicitada/i);
    expect(screen.getByRole('button', { name: /cuenta pedida/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /pedir la cuenta$/i })).not.toBeInTheDocument();
  });
});
