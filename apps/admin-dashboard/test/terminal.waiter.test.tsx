import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TerminalMeseroPage from '../src/app/(terminal)/terminal-mesero/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/terminal-mesero',
}));

describe('U8: Terminal de Mesero Móvil-First (R6 Asignación por Zona, Llamadas y Cobro)', () => {
  const originalFetch = global.fetch;

  const sampleZones = [
    { id: 'zone-terraza', name: 'Terraza', sortOrder: 1, staffIds: ['u-waiter-1'] },
    { id: 'zone-salon', name: 'Salón Principal', sortOrder: 2, staffIds: ['u-waiter-2'] },
  ];

  const sampleTables = [
    { tableId: 'tbl-1', label: '1', capacity: 4, zoneId: 'zone-terraza', status: 'AVAILABLE' as const },
    { tableId: 'tbl-2', label: '2', capacity: 2, zoneId: 'zone-salon', status: 'AVAILABLE' as const },
  ];

  const sampleSessions = [
    { sessionId: 'sess-1', tableId: 'tbl-1', status: 'active' },
  ];

  const sampleCalls = [
    {
      callId: 'call-1',
      id: 'call-1',
      tenantId: 'tenant-demo',
      tableId: 'tbl-1',
      type: 'BILL_REQUEST',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    ApiClient.token = 'valid-token';

    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-waiter-1', email: 'mesero@resto.com', displayName: 'Carlos Mesero', role: 'WAITER' })
    );

    const jsonResponse = (data: any) => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => data,
    });

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      const urlStr = String(url);

      if (urlStr.includes('/v1/zones')) {
        return Promise.resolve(jsonResponse(sampleZones));
      }

      if (urlStr.includes('/v1/tables')) {
        return Promise.resolve(jsonResponse(sampleTables));
      }

      if (urlStr.includes('/v1/sessions?status=active')) {
        return Promise.resolve(jsonResponse(sampleSessions));
      }

      if (urlStr.includes('/v1/service-calls')) {
        return Promise.resolve(jsonResponse(sampleCalls));
      }

      if (urlStr.includes('/v1/orders')) {
        return Promise.resolve(jsonResponse([]));
      }

      if (urlStr.includes('/v1/tenant/settings')) {
        return Promise.resolve(jsonResponse({ operatingMode: 'hybrid', estimatedPrepMinutes: 18 }));
      }

      if (urlStr.includes('/v1/graphql')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
              products: [
                {
                  id: 'prod-1',
                  name: 'Bruschetta',
                  price: 15000,
                  isAvailable: true,
                  category: { id: 'cat-1', name: 'Entradas' },
                },
              ],
            },
          })
        );
      }

      return Promise.resolve(jsonResponse({}));
    }) as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('1. Preselecciona automáticamente la zona asignada al mesero (Terraza)', async () => {
    render(<TerminalMeseroPage />);

    await waitFor(() => {
      expect(screen.getByText('Mesa 1')).toBeInTheDocument();
      // Como Carlos está asignado a Terraza, Mesa 2 (Salón) no debería mostrarse en la vista por defecto de su zona
      expect(screen.queryByText('Mesa 2')).not.toBeInTheDocument();
    });
  });

  test('2. Muestra banner de llamada con botón Cobrar que navega a /terminal-caja', async () => {
    render(<TerminalMeseroPage />);

    await waitFor(() => {
      expect(screen.getByText(/solicitando la cuenta/i)).toBeInTheDocument();
    });

    const btnCobrar = screen.getByTestId('banner-cobrar-btn');
    expect(btnCobrar).toBeInTheDocument();
    fireEvent.click(btnCobrar);

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/terminal-caja'));
  });

  test('3. Botón Cambiar abre modal de cambio de mesa y lista mesas libres disponibles', async () => {
    render(<TerminalMeseroPage />);

    await waitFor(() => {
      expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    });

    const btnCambiar = screen.getByRole('button', { name: 'Cambiar' });
    expect(btnCambiar).toBeInTheDocument();
    fireEvent.click(btnCambiar);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/cambiar mesa 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mesa de destino/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar traslado/i })).toBeDisabled();
  });

  test('4. Botón Atender resuelve la llamada con callId real y la remueve de la bandeja (H-A3)', async () => {
    render(<TerminalMeseroPage />);

    await waitFor(() => {
      expect(screen.getByText(/solicitando la cuenta/i)).toBeInTheDocument();
    });

    const btnAtender = screen.getByRole('button', { name: 'Atender' });
    expect(btnAtender).toBeInTheDocument();
    fireEvent.click(btnAtender);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/service-calls/call-1/resolve'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText(/solicitando la cuenta/i)).not.toBeInTheDocument();
    });
  });
});
