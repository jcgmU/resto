import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { KdsOrderCard } from '../src/components/kds/KdsOrderCard';
import { KdsRail } from '../src/components/kds/KdsRail';
import type { OrderDTO } from '@packages/shared-types';

test('tablero y riel muestran el progreso SLA como blob sin tiempo duplicado', () => {
  const now = Date.now();
  const order = {
    id: 'order1', tenantId: 'tenant', sessionId: 'session', tableId: 'table', status: 'PLACED',
    total: 0, createdAt: new Date(now - 10 * 60000).toISOString(), estimatedMinutes: 20,
    items: [{ id: 'i', productId: 'p', productName: 'Plato', quantity: 1, unitPrice: 1, destination: 'kitchen', modifiers: [] }],
  } as OrderDTO;
  const { container, unmount } = render(<KdsOrderCard order={order} tenantSlaMinutes={20} />);
  const card = container.querySelector('[data-component="status-card"]') as HTMLElement;
  expect(card).toHaveAttribute('data-status', 'available');
  expect(card.querySelector('[data-part="blob"]')).toHaveAttribute('data-variant', 'progress');
  expect(card.querySelector('[data-part="blob"]')).toHaveStyle({ width: '50%' });
  expect(within(card).getByTestId('sla-counter')).toHaveTextContent('10m / 20m');
  expect(within(card).queryByText('Tiempo')).not.toBeInTheDocument();
  unmount();
  render(<KdsRail orders={[order]} monitorKind="kitchen" tenantSlaMinutes={20} now={now} />);
  const ticket = screen.getByTestId('rail-ticket-order1');
  expect(ticket).toHaveAttribute('data-component', 'status-card');
  expect(ticket.querySelector('[data-part="blob"]')).toHaveAttribute('data-variant', 'progress');
  expect(ticket.querySelector('[data-part="blob"]')).toHaveStyle({ width: '50%' });
});

test('el progreso avanza con el tiempo sin eventos externos', () => {
  jest.useFakeTimers();
  const now = new Date('2026-11-17T12:00:00Z').getTime();
  jest.setSystemTime(now);
  const order = {
    id: 'clock', tenantId: 'tenant', sessionId: 'session', tableId: 'table', status: 'PLACED',
    total: 0, createdAt: new Date(now - 10 * 60000).toISOString(), estimatedMinutes: 20,
    items: [{ id: 'i', productId: 'p', productName: 'Plato', quantity: 1, unitPrice: 1, destination: 'kitchen', modifiers: [] }],
  } as OrderDTO;
  try {
    const { container } = render(<><KdsOrderCard order={order} /><KdsRail orders={[order]} monitorKind="kitchen" /></>);
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('10m / 20m');
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByTestId('sla-counter')).toHaveTextContent('11m / 20m');
    expect(container.querySelector('[data-component="status-card"] [data-part="blob"]')).toHaveStyle({ width: '55%' });
    expect(screen.getByTestId('rail-ticket-clock').querySelector('[data-part="blob"]')).toHaveStyle({ width: '55%' });
  } finally {
    jest.useRealTimers();
  }
});
