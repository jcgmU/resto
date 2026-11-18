import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BillSummaryCard } from '../src/components/checkout';
import CheckoutPage from '../src/app/(panel)/checkout/page';
import TerminalCajaPage from '../src/app/(terminal)/terminal-caja/page';
import { ApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';

const order = (id: string, status: string, createdAt = '2026-10-14T12:00:00.000Z') => ({
  id,
  tenantId: 't-1',
  sessionId: 'sess-1',
  tableId: 'tbl-1',
  status,
  total: 100,
  items: [{ id: `it-${id}`, productId: 'p-1', productName: 'Tacos', unitPrice: 100, quantity: 1, modifiers: [] }],
  createdAt,
});

const bill = {
  sessionId: 'sess-1',
  tableId: 'tbl-1',
  ordersCount: 2,
  total: 200,
  payment: null,
  orders: [order('ord-1', 'READY'), order('ord-2', 'DELIVERED'), order('ord-cancelada', 'CANCELLED')],
} as any;

const history = [
  { id: 'h1', orderId: 'ord-1', fromStatus: 'PLACED', toStatus: 'IN_KITCHEN', occurredAt: '2026-10-14T12:05:00.000Z' },
  { id: 'h2', orderId: 'ord-1', fromStatus: 'IN_KITCHEN', toStatus: 'READY', occurredAt: '2026-10-14T12:20:00.000Z' },
];

const json = (body: unknown) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body });

describe('BillSummaryCard: ruta de cada orden', () => {
  test('no carga nada hasta pulsar «Ver ruta» y luego muestra OrderRoute en detalle', async () => {
    const onFetchHistory = jest.fn().mockResolvedValue(history);
    render(<BillSummaryCard bill={bill} onFetchHistory={onFetchHistory} />);
    expect(onFetchHistory).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /ver ruta/i })).toHaveLength(2);

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /ver ruta/i })[0]);
    });
    expect(onFetchHistory).toHaveBeenCalledWith('ord-1');
    const route = await screen.findByRole('list', { name: /ruta del plato/i });
    expect(within(route).getAllByRole('listitem')).toHaveLength(4);
    expect(within(route).getByText('+15 min')).toBeInTheDocument();
  });

  test('error con reintento y cierre', async () => {
    const onFetchHistory = jest.fn().mockRejectedValueOnce(new Error('Sin permiso')).mockResolvedValueOnce(history);
    render(<BillSummaryCard bill={bill} onFetchHistory={onFetchHistory} />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /ver ruta/i })[0]);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/sin permiso/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    });
    expect(onFetchHistory).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('list', { name: /ruta del plato/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ocultar ruta/i }));
    expect(screen.queryByRole('list', { name: /ruta del plato/i })).toBeNull();
  });
});

describe.each([
  ['checkout del panel', CheckoutPage],
  ['terminal de caja', TerminalCajaPage],
])('%s', (_name, Page) => {
  const provider = new StaticFeatureFlagProvider({ payments: true });
  let originalFetch: typeof fetch;
  let historyCalls: string[];

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'cashier-jwt';
    historyCalls = [];
    originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      const target = url.toString();
      if (target.includes('/history')) {
        historyCalls.push(target);
        return json(history);
      }
      if (target.includes('/v1/tables')) return json([{ tableId: 'tbl-1', tenantId: 't-1', label: 'Mesa 1', status: 'active', createdAt: '2026-01-01' }]);
      if (/\/v1\/sessions(\?|$)/.test(target)) return json([{ sessionId: 'sess-1', tenantId: 't-1', tableId: 'tbl-1', status: 'active', createdAt: '2026-10-14T12:00:00.000Z', expiresAt: '2026-10-14T16:00:00.000Z' }]);
      if (target.includes('/v1/checkout/sess-1')) return json(bill);
      return json({});
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('ver la ruta de una orden de la cuenta pide /v1/orders/:id/history solo al pulsar', async () => {
    render(
      <FeatureFlagProviderRoot provider={provider}>
        <Page />
      </FeatureFlagProviderRoot>,
    );
    fireEvent.click(await screen.findByText('Mesa 1'));
    const buttons = await screen.findAllByRole('button', { name: /ver ruta/i });
    expect(historyCalls).toHaveLength(0);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(historyCalls).toHaveLength(1));
    expect(historyCalls[0]).toContain('/v1/orders/ord-1/history');
    expect(await screen.findByRole('list', { name: /ruta del plato/i })).toBeInTheDocument();
  });
});
