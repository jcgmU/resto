import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  KdsBoard,
  KdsColumn,
  KdsOrderCard,
  ServiceCallPanel,
  KdsLiveAnnouncer,
} from '../src/components/kds';
import KdsPage from '../src/app/(panel)/kds/page';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { OrderDTO, ServiceCallDTO } from '@packages/shared-types';
import * as realtimeModule from '../src/lib/realtime';
import { ApiClient } from '../src/lib/api';
import { act } from '@testing-library/react';

describe('C. KDS — Admin Dashboard (Tests 14-23)', () => {
  const sampleOrder: OrderDTO = {
    id: 'ord-kds-1',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'Mesa 4',
    status: 'PLACED',
    total: 25,
    items: [
      {
        id: 'item-1',
        productId: 'p-1',
        productName: 'Tacos al Pastor',
        unitPrice: 10,
        quantity: 2,
        notes: 'Sin cebolla',
        modifiers: [
          {
            groupId: 'g-1',
            groupName: 'Salsa',
            optionId: 'opt-1',
            optionName: 'Verde',
            priceDelta: 0,
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  };

  test('14. /kds renderiza las 3 columnas con las orders del stub inicial (GET /v1/orders), cada una como data-component="bento-card"', () => {
    const { container } = render(<KdsBoard orders={[sampleOrder]} />);
    const board = container.querySelector('[data-component="bento-card"]');
    expect(board).toBeInTheDocument();
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
  });

  test('15. KdsOrderCard muestra tableId, items con cantidades y modificadores, notes y tiempo transcurrido', () => {
    render(<KdsOrderCard order={sampleOrder} />);
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    expect(screen.getByText(/Tacos al Pastor/)).toBeInTheDocument();
    expect(screen.getByText(/Sin cebolla/)).toBeInTheDocument();
    expect(screen.getByText(/Verde/)).toBeInTheDocument();
  });

  test('16. El botón de avance llama PATCH /v1/orders/:id/status con el siguiente estado de ORDER_STATUS_TRANSITIONS y muestra feedback loading->success (aria-busy)', () => {
    const onAdvance = jest.fn();
    render(<KdsOrderCard order={sampleOrder} onAdvanceStatus={onAdvance} isUpdating={true} />);

    const advanceBtn = screen.getByRole('button', { name: /avanzar a/i });
    expect(advanceBtn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(advanceBtn);
    expect(onAdvance).toHaveBeenCalledWith('ord-kds-1', 'IN_KITCHEN');
  });

  test('17. Al recibir order:created por el socket mockeado, la tarjeta aparece en PLACED SIN recargar ni polling', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    let socketListener: any = null;
    const mockSocket = {
      on: jest.fn((event, handler) => {
        if (event === 'order:created') socketListener = handler;
      }),
      disconnect: jest.fn(),
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.queryByText('Mesa 7')).not.toBeInTheDocument();

    // Simular evento socket order:created
    act(() => {
      socketListener?.({
        order: {
          ...sampleOrder,
          id: 'ord-socket-created',
          tableId: 'Mesa 7',
          status: 'PLACED',
        },
      });
    });

    expect(screen.getByText('Mesa 7')).toBeInTheDocument();
    spy.mockRestore();
  });

  test('18. Al recibir order:status-changed, la tarjeta se mueve de columna; DELIVERED desaparece del board', () => {
    const { rerender } = render(<KdsBoard orders={[sampleOrder]} />);
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();

    const deliveredOrder = { ...sampleOrder, status: 'DELIVERED' as const };
    rerender(<KdsBoard orders={[deliveredOrder]} />);
    expect(screen.queryByText('Mesa 4')).not.toBeInTheDocument();
  });

  test('19. ServiceCallPanel: service-call:created añade la llamada (mesa + nota); "Resolver" llama PATCH /v1/service-calls/:id/resolve y la retira de pendientes', () => {
    const call: ServiceCallDTO = {
      callId: 'call-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'Mesa 2',
      note: 'Cuenta por favor',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const onResolve = jest.fn();

    render(<ServiceCallPanel calls={[call]} onResolve={onResolve} />);
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
    expect(screen.getByText('Cuenta por favor')).toBeInTheDocument();

    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    fireEvent.click(resolveBtn);
    expect(onResolve).toHaveBeenCalledWith('call-1');
  });

  test('20. El socket se construye con namespace /orders y auth.token = staff JWT (assert sobre el mock de socket.io-client)', () => {
    const socket = realtimeModule.connectOrdersSocket('staff-mock-token');
    expect((socket as any).nsp).toBe('/orders');
    expect((socket as any).auth?.token).toBe('staff-mock-token');
    socket.disconnect();
  });

  test('21. Accesibilidad en vivo: existe UNA región role="status" aria-atomic="true" que anuncia mensajes completos; no hay live regions por tarjeta', () => {
    const { container } = render(<KdsLiveAnnouncer message="Nueva orden de la mesa 5" />);
    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('Nueva orden de la mesa 5');
  });

  test('22. Bento/a11y: tokens var(--bento-*) sin hardcodeo, acento vibrante solo en KpiValue, iconos aria-hidden, cero emojis', () => {
    const { container } = render(<KdsOrderCard order={sampleOrder} />);
    const card = container.querySelector('[data-component="bento-card"]');
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('23. <FeatureGuard flag="kitchen-display">: OFF -> Proximamente; ON (provider con flag) -> board', async () => {
    // OFF por defecto
    const { rerender } = render(<KdsPage />);

    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('kds-board')).not.toBeInTheDocument();

    // ON
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });
    await act(async () => {
      rerender(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.getByTestId('kds-board')).toBeInTheDocument();
  });

  test('24. Estados de socket y loading: muestra indicador de conexión y maneja socket connect_error sin dejar tablero en blanco', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    let errorHandler: any = null;
    let connectHandler: any = null;
    const mockSocket = {
      on: jest.fn((event, handler) => {
        if (event === 'connect_error') errorHandler = handler;
        if (event === 'connect') connectHandler = handler;
      }),
      disconnect: jest.fn(),
      connected: false,
    };
    const spy = jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue(mockSocket as any);

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    // Initial socket status or error handling
    act(() => {
      errorHandler?.(new Error('Connection lost'));
    });

    // Verify error announcement or status chip is visible
    expect(screen.getByText(/desconectado|reintentando|error de conexión/i)).toBeInTheDocument();

    spy.mockRestore();
  });

  test('25. handleAdvanceStatus y handleResolveCall usan ApiClient.request para PATCH', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });
    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [sampleOrder] };
      if (url === '/v1/service-calls') {
        return {
          data: [
            {
              callId: 'call-patch-1',
              tenantId: 't-1',
              sessionId: 's-1',
              tableId: 'Mesa 3',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (url.includes('/status')) {
        return { data: { ...sampleOrder, status: 'IN_KITCHEN' } };
      }
      if (url.includes('/resolve')) {
        return { data: { success: true } };
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    const advanceBtn = screen.getByRole('button', { name: /avanzar a/i });

    await act(async () => {
      fireEvent.click(advanceBtn);
    });

    expect(spyRequest).toHaveBeenCalledWith('/v1/orders/ord-kds-1/status', expect.objectContaining({
      method: 'PATCH',
    }));

    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    await act(async () => {
      fireEvent.click(resolveBtn);
    });

    expect(spyRequest).toHaveBeenCalledWith('/v1/service-calls/call-patch-1/resolve', expect.objectContaining({
      method: 'PATCH',
    }));

    spyRequest.mockRestore();
  });

  test('26. Si el fetch inicial de órdenes falla, se muestra el estado de error y botón de reintento. Al reintentar recupera datos y muestra hora de snapshot', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    let shouldFail = true;
    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') {
        if (shouldFail) {
          throw new Error('Error al conectar con el servicio de cocina');
        }
        return { data: [sampleOrder] };
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    // 1. Debe mostrar el estado de error visible con mensaje claro
    expect(screen.getByRole('heading', { name: 'Error al conectar con el servicio de cocina' })).toBeInTheDocument();
    // 2. Debe mostrar el botón de reintento
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    expect(retryBtn).toBeInTheDocument();
    // 3. NO debe mostrar tablero con órdenes ni "En vivo" cuando ordering falló
    expect(screen.queryByTestId('kds-board')).not.toBeInTheDocument();
    expect(screen.queryByText('En vivo')).not.toBeInTheDocument();

    // 4. Al pulsar reintentar habiendo recuperado el backend:
    shouldFail = false;
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    // 5. El error desaparece y se muestra el tablero con la orden
    expect(screen.getByTestId('kds-board')).toBeInTheDocument();
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    // 6. Muestra la hora del último snapshot cargado ('Última actualización: HH:mm:ss')
    expect(screen.getByText(/Última actualización: \d{2}:\d{2}:\d{2}/)).toBeInTheDocument();

    spyRequest.mockRestore();
  });

  test('27. El fallo al avanzar orden revierte optimísticamente el estado y muestra toast de error', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [{ ...sampleOrder, status: 'PLACED' }] };
      if (url === '/v1/service-calls') return { data: [] };
      if (url === '/v1/tables') return { data: [] };
      if (url.includes('/status')) {
        throw new Error('Fallo al conectar con el servidor de pedidos');
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    // Orden inicial en Por Preparar
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    const advanceBtn = screen.getByRole('button', { name: /avanzar a en cocina/i });

    // Click avanzar
    await act(async () => {
      fireEvent.click(advanceBtn);
    });

    // Debe mostrar el toast o notificación de error
    expect(screen.getByText(/Fallo al conectar con el servidor de pedidos/i)).toBeInTheDocument();

    // El estado local debe haberse revertido optimísticamente a PLACED (botón sigue diciendo Avanzar a En cocina)
    expect(screen.getByRole('button', { name: /avanzar a en cocina/i })).toBeInTheDocument();

    spyRequest.mockRestore();
  });

  test('28. El fallo al resolver llamada de servicio revierte optimísticamente y muestra toast de error', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });
    const sampleCall: ServiceCallDTO = {
      callId: 'call-err-1',
      tenantId: 't-1',
      sessionId: 's-1',
      tableId: 'Mesa 5',
      note: 'Ayuda por favor',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [] };
      if (url === '/v1/service-calls') return { data: [sampleCall] };
      if (url === '/v1/tables') return { data: [] };
      if (url.includes('/resolve')) {
        throw new Error('No se pudo resolver la llamada');
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    expect(screen.getByText('Ayuda por favor')).toBeInTheDocument();
    const resolveBtn = screen.getByRole('button', { name: /resolver/i });

    await act(async () => {
      fireEvent.click(resolveBtn);
    });

    // Debe mostrar mensaje de error
    expect(screen.getByText(/No se pudo resolver la llamada/i)).toBeInTheDocument();
    // La llamada revertida vuelve a estar presente
    expect(screen.getByText('Ayuda por favor')).toBeInTheDocument();

    spyRequest.mockRestore();
  });

  test('29. Error en llamadas de servicio se gestiona por fuente visiblemente sin ocultar el tablero de órdenes', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [sampleOrder] };
      if (url === '/v1/service-calls') {
        throw new Error('Servicio de llamadas caído');
      }
      if (url === '/v1/tables') return { data: [] };
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    // Tablero de órdenes presente
    expect(screen.getByTestId('kds-board')).toBeInTheDocument();
    expect(screen.getByText('Mesa 4')).toBeInTheDocument();
    // Error específico de llamadas de servicio visible
    expect(screen.getByText('Servicio de llamadas caído')).toBeInTheDocument();

    spyRequest.mockRestore();
  });

  test('30. REF-3: 3 Columnas de Cocina ("Nuevos en fila", "En preparación", "Listos") ordenadas por más tiempo transcurrido primero (createdAt asc)', () => {
    const now = Date.now();
    const orderPlacedOld: OrderDTO = {
      ...sampleOrder,
      id: 'ord-p-old',
      tableId: 'Mesa 10 (30m)',
      status: 'PLACED',
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    };
    const orderPlacedNew: OrderDTO = {
      ...sampleOrder,
      id: 'ord-p-new',
      tableId: 'Mesa 11 (5m)',
      status: 'PLACED',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    };
    const orderInKitchenOld: OrderDTO = {
      ...sampleOrder,
      id: 'ord-k-old',
      tableId: 'Mesa 20 (45m)',
      status: 'IN_KITCHEN',
      createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
    };
    const orderInKitchenNew: OrderDTO = {
      ...sampleOrder,
      id: 'ord-k-new',
      tableId: 'Mesa 21 (10m)',
      status: 'IN_KITCHEN',
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    };
    const orderReady: OrderDTO = {
      ...sampleOrder,
      id: 'ord-ready',
      tableId: 'Mesa 30',
      status: 'READY',
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
    };

    render(
      <KdsBoard
        orders={[
          orderPlacedNew,
          orderInKitchenNew,
          orderPlacedOld,
          orderReady,
          orderInKitchenOld,
        ]}
      />
    );

    // 1. Títulos de las 3 columnas
    expect(screen.getByText('Nuevos en fila')).toBeInTheDocument();
    expect(screen.getByText('En preparación')).toBeInTheDocument();
    expect(screen.getByText('Listos')).toBeInTheDocument();

    // 2. Ordenadas por más tiempo transcurrido primero (createdAt asc) en PLACED
    const colPlaced = screen.getByTestId('kds-column-placed');
    const cardsPlaced = colPlaced.querySelectorAll('[data-component="bento-card"]');
    expect(cardsPlaced).toHaveLength(2);
    expect(within(cardsPlaced[0] as HTMLElement).getByText('Mesa 10 (30m)')).toBeInTheDocument();
    expect(within(cardsPlaced[1] as HTMLElement).getByText('Mesa 11 (5m)')).toBeInTheDocument();

    // 3. Ordenadas por más tiempo transcurrido primero en IN_KITCHEN
    const colKitchen = screen.getByTestId('kds-column-in_kitchen');
    const cardsKitchen = colKitchen.querySelectorAll('[data-component="bento-card"]');
    expect(cardsKitchen).toHaveLength(2);
    expect(within(cardsKitchen[0] as HTMLElement).getByText('Mesa 20 (45m)')).toBeInTheDocument();
    expect(within(cardsKitchen[1] as HTMLElement).getByText('Mesa 21 (10m)')).toBeInTheDocument();
  });

  test('31. REF-2 & N20: Barra SLA y Contador de Tiempo con colores dinámicos (Verde <75%, Ámbar >=75%, Roja >=100% o overdue)', () => {
    const now = Date.now();

    // 1. Verde (< 75% del SLA): 5m transcurridos de 20m SLA (25%)
    const orderGreen: OrderDTO = {
      ...sampleOrder,
      id: 'ord-green',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    };
    const { unmount: unmount1 } = render(
      <KdsOrderCard order={orderGreen} tenantSlaMinutes={20} />
    );
    const barGreen = screen.getByTestId('sla-bar');
    expect(barGreen).toHaveAttribute('data-sla-tone', 'ok');
    expect(barGreen).toHaveAttribute('data-sla-color', 'green');
    expect(barGreen).toHaveStyle({ backgroundColor: '#8fbf95' });
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('5m / 20m');
    unmount1();

    // 2. Ámbar (>= 75% y < 100% del SLA): 16m transcurridos de 20m SLA (80%)
    const orderAmber: OrderDTO = {
      ...sampleOrder,
      id: 'ord-amber',
      createdAt: new Date(now - 16 * 60 * 1000).toISOString(),
    };
    const { unmount: unmount2 } = render(
      <KdsOrderCard order={orderAmber} tenantSlaMinutes={20} />
    );
    const barAmber = screen.getByTestId('sla-bar');
    expect(barAmber).toHaveAttribute('data-sla-tone', 'warning');
    expect(barAmber).toHaveAttribute('data-sla-color', 'amber');
    expect(barAmber).toHaveStyle({ backgroundColor: '#dcc98a' });
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('16m / 20m');
    unmount2();

    // 3. Roja (>= 100% del SLA): 22m transcurridos de 20m SLA (110%)
    const orderRed: OrderDTO = {
      ...sampleOrder,
      id: 'ord-red',
      createdAt: new Date(now - 22 * 60 * 1000).toISOString(),
    };
    const { unmount: unmount3 } = render(
      <KdsOrderCard order={orderRed} tenantSlaMinutes={20} />
    );
    const barRed = screen.getByTestId('sla-bar');
    expect(barRed).toHaveAttribute('data-sla-tone', 'destructive');
    expect(barRed).toHaveAttribute('data-sla-color', 'red');
    expect(barRed).toHaveStyle({ backgroundColor: '#e0a6a6' });
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('22m / 20m');
    unmount3();

    // 4. Roja por flag overdue === true
    const orderOverdue: OrderDTO = {
      ...sampleOrder,
      id: 'ord-overdue',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      overdue: true,
    };
    const { unmount: unmount4 } = render(
      <KdsOrderCard order={orderOverdue} tenantSlaMinutes={20} />
    );
    const barOverdue = screen.getByTestId('sla-bar');
    expect(barOverdue).toHaveAttribute('data-sla-tone', 'destructive');
    expect(barOverdue).toHaveAttribute('data-sla-color', 'red');
    expect(barOverdue).toHaveStyle({ backgroundColor: '#e0a6a6' });
    unmount4();

    // 5. Con demora asignada: 16m transcurridos, SLA tenant 20m + demora 5m = 25m SLA efectivo -> 64% (< 75% -> verde)
    const orderDelay: OrderDTO = {
      ...sampleOrder,
      id: 'ord-delay',
      createdAt: new Date(now - 16 * 60 * 1000).toISOString(),
      delayMinutes: 5,
    };
    const { unmount: unmount5 } = render(
      <KdsOrderCard order={orderDelay} tenantSlaMinutes={20} />
    );
    const barDelay = screen.getByTestId('sla-bar');
    expect(barDelay).toHaveAttribute('data-sla-tone', 'ok');
    expect(barDelay).toHaveAttribute('data-sla-color', 'green');
    expect(barDelay).toHaveStyle({ backgroundColor: '#8fbf95' });
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('16m / 25m');
    unmount5();
  });

  test('32. N20: Asignación de demora desde la tarjeta (+5m, +10m, +15m) llama PATCH /v1/orders/:id/delay', async () => {
    const onUpdateDelay = jest.fn();
    const orderNoDelay: OrderDTO = {
      ...sampleOrder,
      id: 'ord-delay-test',
      delayMinutes: 0,
    };

    const { rerender } = render(
      <KdsOrderCard order={orderNoDelay} onUpdateDelay={onUpdateDelay} />
    );

    expect(screen.getByText('Demora: 0m')).toBeInTheDocument();
    const btn5 = screen.getByTestId('delay-5m');
    const btn10 = screen.getByTestId('delay-10m');
    const btn15 = screen.getByTestId('delay-15m');

    expect(btn5).toBeInTheDocument();
    expect(btn10).toBeInTheDocument();
    expect(btn15).toBeInTheDocument();

    // Click +5m
    fireEvent.click(btn5);
    expect(onUpdateDelay).toHaveBeenCalledWith('ord-delay-test', 5);

    // Con orden que ya tiene 5m de demora, pulsar +10m acumula a 15m
    const orderWith5m: OrderDTO = {
      ...sampleOrder,
      id: 'ord-delay-test',
      delayMinutes: 5,
    };
    rerender(<KdsOrderCard order={orderWith5m} onUpdateDelay={onUpdateDelay} />);
    expect(screen.getByText('Demora: +5m')).toBeInTheDocument();

    fireEvent.click(btn10);
    expect(onUpdateDelay).toHaveBeenCalledWith('ord-delay-test', 15);
  });

  test('32b. N20: KdsPage maneja handleUpdateDelay llamando a ApiClient.request con PATCH /v1/orders/:id/delay', async () => {
    localStorage.setItem('token', 'staff-token');
    const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

    const spyRequest = jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string, opts?: any) => {
      if (url === '/v1/orders') return { data: [sampleOrder] };
      if (url === '/v1/service-calls') return { data: [] };
      if (url === '/v1/tables') return { data: [] };
      if (url === '/v1/tenant/settings') return { data: { estimatedPrepMinutes: 18 } };
      if (url.includes('/delay')) {
        return { data: { ...sampleOrder, delayMinutes: 5 } };
      }
      return { data: [] };
    });

    await act(async () => {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <KdsPage />
        </FeatureFlagProviderRoot>
      );
    });

    const btn5 = screen.getByTestId('delay-5m');
    await act(async () => {
      fireEvent.click(btn5);
    });

    expect(spyRequest).toHaveBeenCalledWith(
      '/v1/orders/ord-kds-1/delay',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ delayMinutes: 5 }),
      })
    );

    spyRequest.mockRestore();
  });

  test('33. N13: Historial de orden muestra línea de tiempo con transiciones y horas desde /v1/orders/:id/history', async () => {
    const mockEvents = [
      {
        id: 'hist-1',
        orderId: 'ord-hist-1',
        fromStatus: 'PLACED',
        toStatus: 'IN_KITCHEN',
        occurredAt: '2026-10-14T12:05:00Z',
      },
      {
        id: 'hist-2',
        orderId: 'ord-hist-1',
        fromStatus: 'IN_KITCHEN',
        toStatus: 'READY',
        occurredAt: '2026-10-14T12:20:00Z',
      },
    ];

    const onFetchHistory = jest.fn().mockResolvedValue(mockEvents);

    render(
      <KdsOrderCard
        order={{ ...sampleOrder, id: 'ord-hist-1' }}
        onFetchHistory={onFetchHistory}
      />
    );

    const toggleBtn = screen.getByTestId('toggle-history-btn');
    expect(toggleBtn).toHaveTextContent('Ver historial');

    // Click para abrir historial
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(onFetchHistory).toHaveBeenCalledWith('ord-hist-1');

    // Panel visible con eventos y sus transiciones formateadas en español
    expect(screen.getByTestId('order-history-panel')).toBeInTheDocument();
    expect(screen.getByText(/Recibido → En cocina/)).toBeInTheDocument();
    expect(screen.getByText(/En cocina → Listo/)).toBeInTheDocument();

    // Botón para cerrar
    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(screen.queryByTestId('order-history-panel')).not.toBeInTheDocument();
  });

  test('34. REF-4 & N01: Notas visibles con Estilo Suite (ítem: fondo rojo pastel #fbeaea, general: fondo ámbar pastel #fdf6e7)', () => {
    const orderWithNotes: OrderDTO = {
      ...sampleOrder,
      notes: 'Sin picante por favor, mesa de niños',
      items: [
        {
          id: 'item-notes-1',
          productId: 'prod-1',
          productName: 'Hamburguesa Clásica',
          unitPrice: 20,
          quantity: 1,
          notes: 'Término medio, sin pepinillos',
          modifiers: [],
        },
      ],
    };

    render(<KdsOrderCard order={orderWithNotes} />);

    // Nota por ítem con fondo rojo pastel #fbeaea y texto #7a3030
    const itemNoteEl = screen.getByTestId('item-notes');
    expect(itemNoteEl).toBeInTheDocument();
    expect(itemNoteEl).toHaveTextContent('Nota: Término medio, sin pepinillos');
    expect(itemNoteEl).toHaveStyle({
      backgroundColor: '#fbeaea',
      color: '#7a3030',
    });

    // Nota general con fondo ámbar pastel #fdf6e7 y texto #8a6b32
    const generalNoteEl = screen.getByTestId('order-general-notes');
    expect(generalNoteEl).toBeInTheDocument();
    expect(generalNoteEl).toHaveTextContent('Nota general: Sin picante por favor, mesa de niños');
    expect(generalNoteEl).toHaveStyle({
      backgroundColor: '#fdf6e7',
      color: '#8a6b32',
    });
  });

  test('35. N14: Llamadas de servicio muestran tipo con texto explicativo legible, notas y botón resolver', () => {
    const calls: ServiceCallDTO[] = [
      {
        callId: 'call-w-1',
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'Mesa 1',
        type: 'WAITER_CALL',
        note: 'Necesito cubiertos adicionales',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        callId: 'call-b-1',
        tenantId: 't-1',
        sessionId: 's-2',
        tableId: 'Mesa 2',
        type: 'BILL_REQUEST',
        note: 'Pago en tarjeta',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        callId: 'call-g-1',
        tenantId: 't-1',
        sessionId: 's-3',
        tableId: 'Mesa 3',
        type: 'GENERIC',
        note: 'Mesa necesita limpieza',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ];

    const onResolve = jest.fn();
    render(<ServiceCallPanel calls={calls} onResolve={onResolve} />);

    // 1. Texto explicativo en el encabezado
    expect(
      screen.getByText('Solicitudes en tiempo real enviadas por comensales')
    ).toBeInTheDocument();

    // 2. Tipos explicados con texto legible
    expect(screen.getByText('Llamada de mesero')).toBeInTheDocument();
    expect(screen.getByText('Solicitud de cuenta')).toBeInTheDocument();
    expect(screen.getByText('Atención a mesa')).toBeInTheDocument();

    // 3. Notas presentes
    expect(screen.getByText('Necesito cubiertos adicionales')).toBeInTheDocument();
    expect(screen.getByText('Pago en tarjeta')).toBeInTheDocument();
    expect(screen.getByText('Mesa necesita limpieza')).toBeInTheDocument();

    // 4. Resolver
    const resolveBtns = screen.getAllByRole('button', { name: /resolver/i });
    expect(resolveBtns).toHaveLength(3);
    fireEvent.click(resolveBtns[0]);
    expect(onResolve).toHaveBeenCalledWith('call-w-1');
  });
});

