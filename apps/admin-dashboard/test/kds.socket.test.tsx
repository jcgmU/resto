import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import KdsPage from '../src/app/(panel)/kds/page';
import { KdsBoard } from '../src/components/kds';
import { ApiClient } from '../src/lib/api';
import * as realtimeModule from '../src/lib/realtime';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

describe('R09 KDS: Resiliencia de WebSocket y Reconexión', () => {
  const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

  beforeEach(() => {
    localStorage.clear(); // NO existe la key 'token'
    ApiClient.token = null;
    jest.clearAllMocks();
  });

  test('KdsPage conecta socket con ApiClient.token cuando localStorage NO tiene key "token"', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const mockSocket = {
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith('resto_jwt_valido');
      });
    } finally {
      spy.mockRestore();
    }
  });

  test('La reconexión del socket dispara refetch de snapshot completo y refresca token con getValidAccessToken()', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const socketListeners: Record<string, Function> = {};
    const mockSocket = {
      on: jest.fn((event, handler) => {
        socketListeners[event] = handler;
      }),
      disconnect: jest.fn(),
      auth: { token: 'resto_jwt_valido' },
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);
    const tokenSpy = jest.spyOn(ApiClient, 'getValidAccessToken').mockResolvedValue('fresh_token_123');
    const requestSpy = jest.spyOn(ApiClient, 'request').mockResolvedValue({ data: [] });

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );

      // Verify connect handler was registered
      expect(socketListeners['connect']).toBeDefined();

      // Reset count of requestSpy from mount
      requestSpy.mockClear();
      tokenSpy.mockClear();

      // Simular reconexión del socket (disparo de evento connect)
      await act(async () => {
        await socketListeners['connect']();
      });

      // Debe haber refrescado el token
      expect(tokenSpy).toHaveBeenCalled();
      // Debe haber actualizado el token en socket.auth
      expect(mockSocket.auth.token).toBe('fresh_token_123');
      // Debe haber vuelto a solicitar snapshot completo (/v1/orders, /v1/service-calls, /v1/tables)
      expect(requestSpy).toHaveBeenCalledWith('/v1/orders');
      expect(requestSpy).toHaveBeenCalledWith('/v1/service-calls');
      expect(requestSpy).toHaveBeenCalledWith('/v1/tables');
    } finally {
      socketSpy.mockRestore();
      tokenSpy.mockRestore();
      requestSpy.mockRestore();
    }
  });

  test('El evento connect_error muestra "Desconectado - Reconectando..." en la UI y refresca token', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const socketListeners: Record<string, Function> = {};
    const mockSocket = {
      on: jest.fn((event, handler) => {
        socketListeners[event] = handler;
      }),
      disconnect: jest.fn(),
      auth: { token: 'resto_jwt_valido' },
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);
    const tokenSpy = jest.spyOn(ApiClient, 'getValidAccessToken').mockResolvedValue('refreshed_reconnect_token');
    const requestSpy = jest.spyOn(ApiClient, 'request').mockResolvedValue({ data: [] });

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );

      expect(socketListeners['connect_error']).toBeDefined();

      // Simular fallo de conexión del socket
      await act(async () => {
        await socketListeners['connect_error']();
      });

      // Debe refrescar token para el siguiente intento
      expect(tokenSpy).toHaveBeenCalled();
      expect(mockSocket.auth.token).toBe('refreshed_reconnect_token');
      // Debe mostrar el chip de estado con mensaje claro de reconexión
      expect(screen.getByText('Desconectado - Reconectando...')).toBeInTheDocument();
    } finally {
      socketSpy.mockRestore();
      tokenSpy.mockRestore();
      requestSpy.mockRestore();
    }
  });

  test('REF-2 & REF-3: KdsPage carga estimatedPrepMinutes de /v1/tenant/settings y aplica SLA dinámico a pedidos entrantes por socket', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const socketListeners: Record<string, Function> = {};
    const mockSocket = {
      on: jest.fn((event, handler) => {
        socketListeners[event] = handler;
      }),
      disconnect: jest.fn(),
      auth: { token: 'resto_jwt_valido' },
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    const now = Date.now();
    const existingOrder = {
      id: 'ord-socket-existing',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'Mesa 1',
      status: 'PLACED' as const,
      total: 15,
      items: [
        {
          id: 'it-1',
          productId: 'prod-1',
          productName: 'Café',
          unitPrice: 5,
          quantity: 1,
          modifiers: [],
        },
      ],
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    };

    const requestSpy = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [existingOrder] };
      if (url === '/v1/service-calls') return { data: [] };
      if (url === '/v1/tables') return { data: [] };
      if (url === '/v1/tenant/settings') return { data: { estimatedPrepMinutes: 25 } };
      return { data: [] };
    });

    try {
      await act(async () => {
        render(
          <FeatureFlagProviderRoot provider={provider}>
            <KdsPage />
          </FeatureFlagProviderRoot>
        );
      });

      // 1. Verifica llamada a /v1/tenant/settings
      expect(requestSpy).toHaveBeenCalledWith('/v1/tenant/settings');

      // 2. SLA counter muestra el SLA de 25m configurado en el tenant
      expect(screen.getByTestId('sla-counter')).toHaveTextContent('10m / 25m');

      // 3. Llega una nueva orden por socket
      const incomingOrder = {
        id: 'ord-socket-new',
        tenantId: 't-1',
        sessionId: 's-2',
        tableId: 'Mesa 2',
        status: 'PLACED' as const,
        total: 20,
        items: [
          {
            id: 'it-2',
            productId: 'prod-2',
            productName: 'Té',
            unitPrice: 5,
            quantity: 1,
            modifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
      };

      await act(async () => {
        socketListeners['order:created']?.({ order: incomingOrder });
      });

      // La nueva orden aparece en 'Nuevos en fila' con su contador basado en el SLA de 25m
      expect(screen.getByText('Mesa 2')).toBeInTheDocument();
      const slaCounters = screen.getAllByTestId('sla-counter');
      expect(slaCounters).toHaveLength(2);
      expect(slaCounters[1]).toHaveTextContent('0m / 25m');
    } finally {
      socketSpy.mockRestore();
      requestSpy.mockRestore();
    }
  });

  test('U2 (D2.4): order:status-changed con orden que pasa a CANCELLED (y kitchenStatus/barStatus CANCELLED o parcialmente nulo) retira la orden del tablero general y de las vistas monitor cocina/bar', async () => {
    ApiClient.token = 'resto_jwt_valido';
    const socketListeners: Record<string, Function> = {};
    const mockSocket = {
      on: jest.fn((event, handler) => {
        socketListeners[event] = handler;
      }),
      disconnect: jest.fn(),
      auth: { token: 'resto_jwt_valido' },
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    const mixedOrder = {
      id: 'ord-cancel-checkout-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'Mesa 9',
      status: 'IN_KITCHEN' as const,
      kitchenStatus: 'IN_KITCHEN' as const,
      barStatus: 'READY' as const,
      total: 40000,
      items: [
        {
          id: 'it-k',
          productId: 'prod-k',
          productName: 'Lomo Saltado',
          destination: 'kitchen' as const,
          unitPrice: 30000,
          quantity: 1,
          modifiers: [],
        },
        {
          id: 'it-b',
          productId: 'prod-b',
          productName: 'Limonada',
          destination: 'bar' as const,
          unitPrice: 10000,
          quantity: 1,
          modifiers: [],
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const requestSpy = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [mixedOrder] };
      if (url === '/v1/service-calls') return { data: [] };
      if (url === '/v1/tables') return { data: [] };
      if (url === '/v1/tenant/settings') return { data: { estimatedPrepMinutes: 18 } };
      return { data: [] };
    });

    try {
      // 1. KdsPage en modo monitor de cocina
      localStorage.setItem('resto_user', JSON.stringify({ id: 'm-1', role: 'MONITOR', monitorKind: 'kitchen' }));
      const { unmount } = render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa 9')).toBeInTheDocument();
        expect(screen.getByText(/Lomo Saltado/i)).toBeInTheDocument();
      });

      const cancelledOrder = {
        ...mixedOrder,
        status: 'CANCELLED' as const,
        kitchenStatus: 'CANCELLED' as const,
        barStatus: 'CANCELLED' as const,
        cancelReason: 'checkout',
        cancelledAt: new Date().toISOString(),
      };

      await act(async () => {
        socketListeners['order:status-changed']?.({
          order: cancelledOrder,
          status: 'CANCELLED',
        });
      });

      await waitFor(() => {
        expect(screen.queryByText('Mesa 9')).not.toBeInTheDocument();
        expect(screen.queryByText(/Lomo Saltado/i)).not.toBeInTheDocument();
      });

      unmount();

      // 2. KdsBoard en vista general y vista bar: incluso si un payload parcial trae status='CANCELLED' sin kitchenStatus/barStatus o con ambos CANCELLED
      const { rerender } = render(<KdsBoard orders={[mixedOrder]} monitorKind="bar" />);
      expect(screen.getByText('Mesa 9')).toBeInTheDocument();
      expect(screen.getByText(/Limonada/i)).toBeInTheDocument();

      // Si pasa a CANCELLED (incluso si barStatus seguía en READY por un payload parcial), nunca debe mostrarse una orden con status === 'CANCELLED'
      rerender(
        <KdsBoard
          orders={[{ ...mixedOrder, status: 'CANCELLED', barStatus: 'READY' }]}
          monitorKind="bar"
        />
      );
      expect(screen.queryByText('Mesa 9')).not.toBeInTheDocument();
    } finally {
      socketSpy.mockRestore();
      requestSpy.mockRestore();
    }
  });
});

