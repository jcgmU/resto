import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import KdsPage from '../src/app/(panel)/kds/page';
import { ApiClient } from '../src/lib/api';
import * as realtimeModule from '../src/lib/realtime';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

const provider = new StaticFeatureFlagProvider({ 'kitchen-display': true });

const item = (name: string, destination: 'kitchen' | 'bar') => ({
  id: `it-${name}`,
  productId: `p-${name}`,
  productName: name,
  unitPrice: 1000,
  quantity: 1,
  destination,
  modifiers: [],
});

const mixedOrder = {
  id: 'ord-1',
  tenantId: 't-1',
  sessionId: 's-1',
  tableId: 'tb-1',
  status: 'PLACED' as const,
  total: 2000,
  delayMinutes: 5,
  notes: 'Sin cebolla',
  items: [item('Tiramisu', 'kitchen'), item('Mojito', 'bar')],
  createdAt: new Date().toISOString(),
};

describe('Monitor (cocina y bar) usa el mismo tablero que el admin', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'resto_jwt_valido';
    jest.spyOn(realtimeModule, 'connectOrdersSocket').mockReturnValue({ on: jest.fn(), disconnect: jest.fn() } as any);
    jest.spyOn(ApiClient, 'request').mockImplementation(async (url: string) => {
      if (url === '/v1/orders') return { data: [mixedOrder] };
      if (url === '/v1/tables') return { data: [{ tableId: 'tb-1', label: 'Mesa 7', capacity: 4 }] };
      if (url === '/v1/tenant/settings') return { data: { estimatedPrepMinutes: 18 } };
      return { data: [] };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test.each([
    ['kitchen', 'Tiramisu', 'Mojito'],
    ['bar', 'Mojito', 'Tiramisu'],
  ] as const)('monitor de %s: 3 columnas, demora, historial, nota, mesa y solo sus ítems', async (kind, mine, other) => {
    localStorage.setItem('resto_user', JSON.stringify({ id: 'm-1', role: 'MONITOR', monitorKind: kind }));
    render(
      <FeatureFlagProviderRoot provider={provider}>
        <KdsPage />
      </FeatureFlagProviderRoot>
    );

    await waitFor(() => expect(screen.getByTestId('kds-board')).toBeInTheDocument());
    expect(screen.queryByTestId('kds-rail')).not.toBeInTheDocument();

    for (const title of [/Nuevos en fila/i, /En preparación/i]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByText(new RegExp(mine))).toBeInTheDocument());
    expect(screen.queryByText(new RegExp(other))).not.toBeInTheDocument();
    expect(screen.getByText('Mesa 7')).toBeInTheDocument();
    expect(screen.getByText(/Sin cebolla/i)).toBeInTheDocument();
    expect(screen.getByText(/Demora: \+5m/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Asignar \+5m de demora/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver historial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avanzar a/i })).toBeInTheDocument();
  });
});
