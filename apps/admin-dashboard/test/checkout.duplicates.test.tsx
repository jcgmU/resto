import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CheckoutPage from '../src/app/(panel)/checkout/page';
import { ActiveTablesGrid } from '../src/components/checkout';
import { ApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

const session = (sessionId: string, tableId: string, createdAt = '2026-10-12T10:00:00.000Z') => ({
  sessionId,
  tenantId: 't-1',
  tableId,
  status: 'active' as const,
  createdAt,
  expiresAt: '2026-10-12T14:00:00.000Z',
});

const tables = [
  { tableId: 'tbl-A', tenantId: 't-1', label: 'Mesa A', status: 'active', createdAt: '2026-01-01' },
  { tableId: 'tbl-B', tenantId: 't-1', label: 'Mesa B', status: 'active', createdAt: '2026-01-01' },
] as any;

describe('Checkout: cada mesa se muestra una sola vez', () => {
  test('la misma sesión repetida en la lista se pinta una vez', () => {
    render(<ActiveTablesGrid sessions={[session('s-1', 'tbl-A'), session('s-1', 'tbl-A')]} tables={tables} />);
    expect(screen.getAllByText('Mesa A')).toHaveLength(1);
  });

  test('dos sesiones activas de la misma mesa (legado) agrupan en una tarjeta con una fila por sesión', () => {
    const onSelect = jest.fn();
    render(
      <ActiveTablesGrid
        sessions={[session('s-old', 'tbl-A', '2026-10-12T09:00:00.000Z'), session('s-new', 'tbl-A', '2026-10-12T11:00:00.000Z'), session('s-b', 'tbl-B')]}
        tables={tables}
        onSelectSession={onSelect}
      />,
    );
    expect(screen.getAllByText('Mesa A')).toHaveLength(1);
    expect(screen.getByText(/2 sesiones activas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Sesión #snew/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's-new' }));
    fireEvent.click(screen.getByText(/Sesión #sold/));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 's-old' }));
  });

  test('la tarjeta agrupada queda seleccionada cuando se elige cualquiera de sus sesiones', () => {
    const { container } = render(
      <ActiveTablesGrid
        sessions={[session('s-old', 'tbl-A', '2026-10-12T09:00:00.000Z'), session('s-new', 'tbl-A', '2026-10-12T11:00:00.000Z')]}
        tables={tables}
        selectedSessionId="s-old"
      />,
    );
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
  });
});

describe('Checkout: refetch fuera de orden', () => {
  const provider = new StaticFeatureFlagProvider({ payments: true });
  const json = (body: unknown) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body });

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'admin-jwt-token';
  });

  test('una respuesta vieja que llega tarde no pisa la lista más reciente', async () => {
    let sessionCalls = 0;
    let resolveStale!: (value: unknown) => void;
    const stale = new Promise((resolve) => {
      resolveStale = resolve;
    });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const target = url.toString();
      if (target.includes('/v1/tables')) return json(tables);
      if (/\/v1\/sessions(\?|$)/.test(target)) {
        sessionCalls += 1;
        if (sessionCalls === 1) return json([session('s-a', 'tbl-A')]);
        if (sessionCalls === 2) return stale;
        return json([session('s-a', 'tbl-A'), session('s-b', 'tbl-B')]);
      }
      return json({});
    }) as any;

    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>,
      );
      await screen.findByText('Mesa A');

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await screen.findByText('Mesa B');

      await act(async () => {
        resolveStale(json([session('s-a', 'tbl-A')]));
      });
      expect(screen.getByText('Mesa A')).toBeInTheDocument();
      expect(screen.getByText('Mesa B')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('si el servidor repite una sesión en la lista, la página muestra la mesa una vez', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const target = url.toString();
      if (target.includes('/v1/tables')) return json(tables);
      if (/\/v1\/sessions(\?|$)/.test(target)) return json([session('s-a', 'tbl-A'), session('s-a', 'tbl-A')]);
      return json({});
    }) as any;
    try {
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <CheckoutPage />
        </FeatureFlagProviderRoot>,
      );
      await screen.findByText('Mesa A');
      await waitFor(() => expect(screen.getAllByText('Mesa A')).toHaveLength(1));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
