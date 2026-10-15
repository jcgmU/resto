import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { OrderConfirmationCard } from '../src/components/cart/OrderConfirmationCard';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';
import {
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { OrderDTO } from '@packages/shared-types';

describe('U14: B6 seguimiento/polling + B7 pedir cuenta + B8 pago guest', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'guest-token-u14';
    PwaApiClient.session = {
      sessionId: 'sess-u14',
      tenantId: 'tenant-u14',
      tableId: 'tb-u14',
      status: 'active',
    };
    jest.clearAllMocks();
  });

  test('U14.1 PwaApiClient.getOrder realiza GET /v1/orders/:orderId con Authorization: Bearer guestToken', async () => {
    const originalFetch = global.fetch;
    const mockOrder: OrderDTO = {
      id: 'ord-123456',
      tenantId: 'tenant-u14',
      sessionId: 'sess-u14',
      tableId: 'tb-u14',
      status: 'PLACED',
      total: 50,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/orders/ord-123456')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => mockOrder,
        };
      }
      return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
    });
    global.fetch = fetchMock as any;

    try {
      const result = await PwaApiClient.getOrder('ord-123456');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/ord-123456'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer guest-token-u14',
          }),
        })
      );
      expect(result.id).toBe('ord-123456');
      expect(result.status).toBe('PLACED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U14.2 OrderConfirmationCard renderiza ProgressNodes con pasos ["Recibido", "En cocina", "Listo", "Entregado"] y estado inicial PLACED en paso 0', () => {
    const initialOrder: OrderDTO = {
      id: 'ord-998877',
      tenantId: 'tenant-u14',
      sessionId: 'sess-u14',
      tableId: 'tb-u14',
      status: 'PLACED',
      total: 20,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<OrderConfirmationCard order={initialOrder} />);

    expect(screen.getAllByText('Recibido').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('En cocina')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
    expect(screen.getByText('Entregado')).toBeInTheDocument();

    // El paso actual debe ser 'Recibido' con aria-current="step"
    const currentStep = container.querySelector('li[aria-current="step"]');
    expect(currentStep).toHaveTextContent('Recibido');
    expect(screen.getByText(/El personal ha recibido tu pedido/i)).toBeInTheDocument();
  });

  test('U14.3 Polling silencioso avanza el progreso cuando getOrder devuelve estados siguientes y se detiene en DELIVERED', async () => {
    jest.useFakeTimers();

    const orderState: OrderDTO = {
      id: 'ord-poll-1',
      tenantId: 'tenant-u14',
      sessionId: 'sess-u14',
      tableId: 'tb-u14',
      status: 'PLACED',
      total: 25,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const getOrderSpy = jest.spyOn(PwaApiClient, 'getOrder').mockImplementation(async (id: string) => {
      return { ...orderState };
    });

    try {
      const { container } = render(
        <OrderConfirmationCard order={{ ...orderState }} pollIntervalMs={5000} />
      );

      // Inicial: paso 0 (Recibido)
      expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent('Recibido');

      // 1er tick: backend actualiza a IN_KITCHEN
      orderState.status = 'IN_KITCHEN';
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(getOrderSpy).toHaveBeenCalledTimes(1);
      expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent('En cocina');

      // 2do tick: backend actualiza a READY
      orderState.status = 'READY';
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(getOrderSpy).toHaveBeenCalledTimes(2);
      expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent('Listo');

      // 3er tick: backend actualiza a DELIVERED (estado terminal)
      orderState.status = 'DELIVERED';
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(getOrderSpy).toHaveBeenCalledTimes(3);
      expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent('Entregado');

      // 4to tick: como DELIVERED es terminal, el polling debe haberse detenido y no hacer más llamadas
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(getOrderSpy).toHaveBeenCalledTimes(3);
    } finally {
      getOrderSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('U14.4 Polling se detiene cuando getOrder devuelve CANCELLED y muestra problemSegment y alerta accesible', async () => {
    jest.useFakeTimers();

    const orderState: OrderDTO = {
      id: 'ord-poll-cancel',
      tenantId: 'tenant-u14',
      sessionId: 'sess-u14',
      tableId: 'tb-u14',
      status: 'PLACED',
      total: 25,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const getOrderSpy = jest.spyOn(PwaApiClient, 'getOrder').mockImplementation(async () => {
      return { ...orderState };
    });

    try {
      const { container } = render(
        <OrderConfirmationCard order={{ ...orderState }} pollIntervalMs={5000} />
      );

      // Simular cambio a CANCELLED
      orderState.status = 'CANCELLED';
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(getOrderSpy).toHaveBeenCalledTimes(1);

      // Debe mostrar problemSegment (segmento con data-problem="true")
      const problemSegment = container.querySelector('[data-problem="true"]');
      expect(problemSegment).toBeInTheDocument();

      // Debe mostrar mensaje accesible de cancelación
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/cancelado/i);

      // No debe haber más llamadas de polling (CANCELLED es terminal)
      await act(async () => {
        jest.advanceTimersByTime(15000);
      });
      expect(getOrderSpy).toHaveBeenCalledTimes(1);
    } finally {
      getOrderSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('U14.5 OrderConfirmationCard limpia el intervalo de polling al desmontarse', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const order: OrderDTO = {
      id: 'ord-unmount',
      tenantId: 'tenant-u14',
      sessionId: 'sess-u14',
      tableId: 'tb-u14',
      status: 'PLACED',
      total: 10,
      items: [],
      createdAt: new Date().toISOString(),
    };

    const { unmount } = render(<OrderConfirmationCard order={order} />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  test('U14.6 B7 Pedir la cuenta tiene estados accesibles solicitando / solicitada / error con StatusChip y Alert', async () => {
    const originalFetch = global.fetch;
    let callCount = 0;

    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
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
          json: async () => ({ tenantId: 't-1', sessionId: 's-1', items: [], total: 0 }),
        };
      }
      if (urlStr.includes('/bill-request') && opts?.method === 'POST') {
        callCount++;
        if (callCount === 1) {
          // Primer intento falla
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'Error de conexión con el servicio de sesión' }),
          };
        }
        // Segundo intento triunfa
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ id: 's-1', status: 'billRequested' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-u14', tableId: 'tb-u14' }} />);

      // Estado inicial: botón pedir la cuenta
      const btn = await screen.findByRole('button', { name: /pedir la cuenta/i });
      expect(btn).toBeInTheDocument();

      // Clic 1: falla -> estado error accesible
      fireEvent.click(btn);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/error/i);

      // Clic 2: éxito -> estado solicitada con StatusChip
      const retryBtn = screen.getByRole('button', { name: /reintentar/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/cuenta pedida\. un mesero se acercará con la cuenta/i)
        ).toBeInTheDocument();
      });

      // StatusChip de cuenta solicitada
      const chip = screen.getByTestId('bill-status-chip');
      expect(chip).toHaveTextContent(/cuenta solicitada/i);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U14.7 R10 Cobro solo por personal: el cliente/guest no tiene botón ni opción de Pagar independientemente de las flags', () => {
    // Caso 1: Flag payments off (default)
    const providerOff = new StaticFeatureFlagProvider({ payments: false });
    const { unmount } = render(
      <FeatureFlagProviderRoot provider={providerOff}>
        <ClientMenuPage params={{ tenantId: 'tenant-u14', tableId: 'tb-u14' }} />
      </FeatureFlagProviderRoot>
    );

    expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^pagar$/i)).not.toBeInTheDocument();
    unmount();

    // Caso 2: Flag payments on
    const providerOn = new StaticFeatureFlagProvider({ payments: true });
    render(
      <FeatureFlagProviderRoot provider={providerOn}>
        <ClientMenuPage params={{ tenantId: 'tenant-u14', tableId: 'tb-u14' }} />
      </FeatureFlagProviderRoot>
    );

    expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^pagar$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pedir la cuenta/i })).toBeInTheDocument();
  });
});
