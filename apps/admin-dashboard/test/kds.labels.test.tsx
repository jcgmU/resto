import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { KdsOrderCard, ServiceCallPanel, KdsBoard } from '../src/components/kds';
import { OrderDTO, ServiceCallDTO, TableDTO } from '@packages/shared-types';
import { ApiClient } from '../src/lib/api';
import KdsPage from '../src/app/(panel)/kds/page';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';
import { act } from '@testing-library/react';
import * as realtimeModule from '../src/lib/realtime';

describe('U24 (H7): Enums e IDs crudos en KDS a español', () => {
  const sampleTables: TableDTO[] = [
    {
      tableId: 'table-1791762875669-723',
      tenantId: 't-1',
      label: 'Terraza 4',
      status: 'active',
      createdAt: '2026-10-10T00:00:00Z',
    },
    {
      tableId: 'table-salon-1',
      tenantId: 't-1',
      label: 'Salón Principal',
      status: 'active',
      createdAt: '2026-10-10T00:00:00Z',
    },
  ];

  const sampleOrder: OrderDTO = {
    id: 'ord-zc8lj',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'table-1791762875669-723',
    status: 'PLACED',
    total: 30,
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Ensalada César',
        unitPrice: 15,
        quantity: 2,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  test('KdsOrderCard: resuelve label real de la mesa desde tables', () => {
    render(<KdsOrderCard order={sampleOrder} tables={sampleTables} />);
    expect(screen.getByText('Terraza 4')).toBeInTheDocument();
    expect(screen.queryByText('table-1791762875669-723')).not.toBeInTheDocument();
  });

  test('KdsOrderCard: muestra respaldo Mesa · <shortId> si la mesa no está en tables', () => {
    const unknownTableOrder: OrderDTO = {
      ...sampleOrder,
      tableId: 'table-1791762875669-723',
    };
    render(<KdsOrderCard order={unknownTableOrder} tables={[]} />);
    expect(screen.getByText('Mesa · 669723')).toBeInTheDocument();
    expect(screen.queryByText('table-1791762875669-723')).not.toBeInTheDocument();
  });

  test('KdsOrderCard: número de orden usa formatOrderNumber evitando prefijos y guiones sueltos', () => {
    render(<KdsOrderCard order={sampleOrder} tables={sampleTables} />);
    expect(screen.getByText('Orden #zc8lj')).toBeInTheDocument();
    expect(screen.queryByText(/#-zc8lj/)).not.toBeInTheDocument();
  });

  test('KdsOrderCard: botón de transición traduce el siguiente estado a español (PLACED -> En cocina)', () => {
    const onAdvance = jest.fn();
    render(<KdsOrderCard order={sampleOrder} tables={sampleTables} onAdvanceStatus={onAdvance} />);
    const btn = screen.getByRole('button', { name: /avanzar a en cocina/i });
    expect(btn).toBeInTheDocument();
    expect(screen.queryByText(/avanzar a in_kitchen/i)).not.toBeInTheDocument();
  });

  test('KdsOrderCard: botón de transición traduce IN_KITCHEN -> Listo', () => {
    const inKitchenOrder: OrderDTO = {
      ...sampleOrder,
      status: 'IN_KITCHEN',
    };
    render(<KdsOrderCard order={inKitchenOrder} tables={sampleTables} onAdvanceStatus={jest.fn()} />);
    const btn = screen.getByRole('button', { name: /avanzar a listo/i });
    expect(btn).toBeInTheDocument();
    expect(screen.queryByText(/avanzar a ready/i)).not.toBeInTheDocument();
  });

  test('ServiceCallPanel: muestra nombre real de mesa con tables y respaldo sin crudo', () => {
    const call1: ServiceCallDTO = {
      callId: 'call-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'table-salon-1',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const call2: ServiceCallDTO = {
      callId: 'call-2',
      tenantId: 't-1',
      sessionId: 's-2',
      tableId: 'table-1791762875669-723',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const { rerender } = render(<ServiceCallPanel calls={[call1]} tables={sampleTables} />);
    expect(screen.getByText('Salón Principal')).toBeInTheDocument();
    expect(screen.queryByText('table-salon-1')).not.toBeInTheDocument();

    rerender(<ServiceCallPanel calls={[call2]} tables={[]} />);
    expect(screen.getByText('Mesa · 669723')).toBeInTheDocument();
    expect(screen.queryByText('table-1791762875669-723')).not.toBeInTheDocument();
  });

  test('KdsBoard: propaga tables a las tarjetas de pedidos', () => {
    render(<KdsBoard orders={[sampleOrder]} tables={sampleTables} />);
    expect(screen.getByText('Terraza 4')).toBeInTheDocument();
    expect(screen.queryByText('table-1791762875669-723')).not.toBeInTheDocument();
  });

  test('KdsPage: carga /v1/tables en loadInitialData y lo provee al tablero y llamadas', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const call: ServiceCallDTO = {
      callId: 'call-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'table-salon-1',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const spy = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [sampleOrder] };
      if (url === '/v1/service-calls') return { data: [call] };
      if (url === '/v1/tables') return { data: sampleTables };
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(spy).toHaveBeenCalledWith('/v1/tables');
    expect(screen.getByText('Terraza 4')).toBeInTheDocument();
    expect(screen.getByText('Salón Principal')).toBeInTheDocument();
    expect(screen.queryByText('table-1791762875669-723')).not.toBeInTheDocument();
    expect(screen.queryByText('table-salon-1')).not.toBeInTheDocument();

    spy.mockRestore();
  });

  test('D9.1: KdsPage renderiza "Pantalla de Cocina" como H2 y no contiene H1', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const spy = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/tables') return { data: sampleTables };
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Pantalla de Cocina/i })).toBeInTheDocument();

    spy.mockRestore();
  });

  test('D9.5: KdsPage anuncia en vivo el nombre resuelto de la mesa (getTableDisplayName) en eventos socket', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const socketListeners: Record<string, (data: any) => void> = {};
    const mockSocket = {
      on: jest.fn((event, handler) => {
        socketListeners[event] = handler;
      }),
      disconnect: jest.fn(),
    };
    const socketSpy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    const spy = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/tables') return { data: sampleTables };
      return { data: [] };
    });

    let container: HTMLElement;
    await act(async () => {
      const rendered = render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
      container = rendered.container;
    });

    const liveRegion = container!.querySelector('[role="status"][aria-atomic="true"]');
    expect(liveRegion).toBeInTheDocument();

    // 1. order:created con mesa conocida
    act(() => {
      socketListeners['order:created']?.({
        order: {
          ...sampleOrder,
          id: 'ord-socket-1',
          tableId: 'table-1791762875669-723',
        },
      });
    });
    expect(liveRegion).toHaveTextContent('Nueva orden de la mesa Terraza 4');

    // 2. order:created con mesa desconocida (respaldo formateado)
    act(() => {
      socketListeners['order:created']?.({
        order: {
          ...sampleOrder,
          id: 'ord-socket-2',
          tableId: 'table-999999123456',
        },
      });
    });
    expect(liveRegion).toHaveTextContent('Nueva orden de la mesa Mesa · 123456');

    // 3. order:status-changed READY
    act(() => {
      socketListeners['order:status-changed']?.({
        order: {
          ...sampleOrder,
          id: 'ord-socket-1',
          tableId: 'table-1791762875669-723',
        },
        status: 'READY',
      });
    });
    expect(liveRegion).toHaveTextContent('Orden de la mesa Terraza 4 lista');

    // 4. service-call:created
    act(() => {
      socketListeners['service-call:created']?.({
        call: {
          callId: 'call-socket-1',
          tenantId: 't-1',
          sessionId: 's-1',
          tableId: 'table-salon-1',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      });
    });
    expect(liveRegion).toHaveTextContent('Llamado de servicio en la mesa Salón Principal');

    socketSpy.mockRestore();
    spy.mockRestore();
  });
});
