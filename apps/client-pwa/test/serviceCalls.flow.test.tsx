import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('R10 / V14: PWA Pedir la Cuenta con POST /v1/sessions/:id/bill-request y estados visibles', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'guest-session-token';
    PwaApiClient.session = {
      sessionId: 'sess-pwa-1',
      tenantId: 'tenant-1',
      tableId: 'Mesa 3',
      status: 'active',
    };
    jest.clearAllMocks();
  });

  test('Botón "Pedir la cuenta" llama a POST /v1/sessions/:id/bill-request, no muestra Pagar y muestra confirmación', async () => {
    let capturedUrl: string | null = null;
    let capturedOpts: any = null;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
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
          json: async () => ({ cartId: 'c-1', sessionId: 'sess-pwa-1', items: [], total: 0 }),
        };
      }

      if (urlStr.includes('/bill-request') && opts?.method === 'POST') {
        capturedUrl = urlStr;
        capturedOpts = opts;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'sess-pwa-1',
            tenantId: 'tenant-1',
            tableId: 'Mesa 3',
            status: 'billRequested',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <ClientMenuPage params={{ tenantId: 'tenant-1', tableId: 'Mesa 3' }} />
        </FeatureFlagProviderRoot>
      );

      // Criterio R10: el cliente/guest no realiza cobros directos, no existe botón de pagar
      expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/^pagar$/i)).not.toBeInTheDocument();

      const requestBillBtn = await screen.findByRole('button', { name: /pedir la cuenta/i });
      expect(requestBillBtn).toBeInTheDocument();

      fireEvent.click(requestBillBtn);

      await waitFor(() => {
        expect(capturedUrl).not.toBeNull();
      });

      expect(capturedUrl).toContain('/v1/sessions/sess-pwa-1/bill-request');
      expect(capturedOpts?.headers?.Authorization).toBe('Bearer guest-session-token');

      // Confirmación inline amigable con copy exacto
      expect(
        await screen.findByText(/cuenta pedida\. un mesero se acercará con la cuenta/i)
      ).toBeInTheDocument();

      // Status chip accesible
      expect(screen.getByTestId('bill-status-chip')).toHaveTextContent(/cuenta solicitada/i);

      // El botón en footer ahora refleja el estado pedido
      expect(screen.getByRole('button', { name: /cuenta pedida/i })).toBeDisabled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Fallo al pedir la cuenta muestra error accesible con mensaje y botón para reintentar', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    let attempt = 0;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: { categories: [], products: [] },
          }),
        };
      }

      if (urlStr.endsWith('/v1/cart')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ cartId: 'c-1', sessionId: 'sess-pwa-1', items: [], total: 0 }),
        };
      }

      if (urlStr.includes('/bill-request') && opts?.method === 'POST') {
        attempt++;
        if (attempt === 1) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'Error de conexión con el servicio de sesión' }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'sess-pwa-1',
            tenantId: 'tenant-1',
            tableId: 'Mesa 3',
            status: 'billRequested',
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <ClientMenuPage params={{ tenantId: 'tenant-1', tableId: 'Mesa 3' }} />
        </FeatureFlagProviderRoot>
      );

      const requestBillBtn = await screen.findByRole('button', { name: /pedir la cuenta/i });
      fireEvent.click(requestBillBtn);

      const alertEl = await screen.findByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent(/error/i);
      expect(alertSpy).not.toHaveBeenCalled();

      // Botón reintentar presente y funcional
      const retryBtn = screen.getByRole('button', { name: /reintentar/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/cuenta pedida\. un mesero se acercará con la cuenta/i)
        ).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      alertSpy.mockRestore();
      global.fetch = originalFetch;
    }
  });
});
