import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { OrderDTO } from '@packages/shared-types';
import { KdsRail, buildRailTickets, countAllDay } from '../src/components/kds/KdsRail';

const NOW = new Date('2026-11-16T20:00:00').getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

function order(over: Partial<OrderDTO> & { id: string }): OrderDTO {
  return {
    tenantId: 't1',
    sessionId: 's1',
    tableId: 'tb-1',
    status: 'PLACED',
    total: 0,
    items: [],
    createdAt: minutesAgo(1),
    ...over,
  } as OrderDTO;
}

const item = (name: string, quantity: number, destination: 'kitchen' | 'bar' = 'kitchen') => ({
  id: `${name}-${destination}`,
  productId: name,
  productName: name,
  unitPrice: 1000,
  quantity,
  destination,
  modifiers: [],
});

const tables = [
  { tableId: 'tb-1', label: 'Mesa 1' },
  { tableId: 'tb-2', label: '2' },
] as any;

const orders: OrderDTO[] = [
  order({ id: 'nuevo', tableId: 'tb-2', createdAt: minutesAgo(2), items: [item('Tiramisu', 2), item('Mojito', 1, 'bar')] }),
  order({ id: 'viejo', tableId: 'tb-1', createdAt: minutesAgo(30), status: 'IN_KITCHEN', items: [item('Tiramisu', 1), item('Cheesecake', 3)] }),
  order({ id: 'listo', tableId: 'tb-1', createdAt: minutesAgo(10), status: 'READY', items: [item('Cheesecake', 5)] }),
  order({ id: 'entregado', status: 'DELIVERED', items: [item('Tiramisu', 9)] }),
  order({ id: 'solo-bar', createdAt: minutesAgo(3), items: [item('Mojito', 4, 'bar')] }),
];

describe('Riel de tickets del monitor', () => {
  test('buildRailTickets: solo el destino del monitor, más antiguo primero, sin entregados', () => {
    const tickets = buildRailTickets(orders, 'kitchen', 18, NOW);
    expect(tickets.map((t) => t.order.id)).toEqual(['viejo', 'listo', 'nuevo']);
    expect(tickets[2].items.map((i) => i.productName)).toEqual(['Tiramisu']);
  });

  test('buildRailTickets: tardío según el SLA de la orden o del tenant más la demora', () => {
    const tickets = buildRailTickets(
      [
        order({ id: 'a', createdAt: minutesAgo(20), items: [item('X', 1)] }),
        order({ id: 'b', createdAt: minutesAgo(20), delayMinutes: 5, items: [item('X', 1)] }),
        order({ id: 'c', createdAt: minutesAgo(8), estimatedMinutes: 5, items: [item('X', 1)] }),
      ],
      'kitchen',
      18,
      NOW
    );
    const late = Object.fromEntries(tickets.map((t) => [t.order.id, t.late]));
    expect(late).toEqual({ a: true, b: false, c: true });
  });

  test('countAllDay: suma lo pendiente (nuevos y en preparación), no lo listo', () => {
    const counts = countAllDay(buildRailTickets(orders, 'kitchen', 18, NOW));
    expect(counts).toEqual([
      { name: 'Tiramisu', quantity: 3 },
      { name: 'Cheesecake', quantity: 3 },
    ]);
  });

  test('KdsRail pinta un ticket por orden con mesa, hora e ítems, y marca el tardío', () => {
    render(<KdsRail orders={orders} tables={tables} monitorKind="kitchen" tenantSlaMinutes={18} now={NOW} />);
    const rail = screen.getByTestId('kds-rail');
    const tickets = within(rail).getAllByTestId(/^rail-ticket-/);
    expect(tickets.map((t) => t.getAttribute('data-testid'))).toEqual([
      'rail-ticket-viejo',
      'rail-ticket-listo',
      'rail-ticket-nuevo',
    ]);

    const viejo = screen.getByTestId('rail-ticket-viejo');
    expect(viejo).toHaveAttribute('data-late', 'true');
    expect(within(viejo).getByText('Mesa 1')).toBeInTheDocument();
    expect(within(viejo).getByText('Cheesecake')).toBeInTheDocument();
    expect(within(viejo).getByText(/Tarde/i)).toBeInTheDocument();
    expect(within(viejo).getByText('19:30')).toBeInTheDocument();

    const nuevo = screen.getByTestId('rail-ticket-nuevo');
    expect(nuevo).toHaveAttribute('data-late', 'false');
    expect(within(nuevo).getByText('Mesa 2')).toBeInTheDocument();
    expect(within(nuevo).queryByText('Mojito')).not.toBeInTheDocument();
  });

  test('el botón avanza al siguiente estado de ese ticket', () => {
    const onAdvance = jest.fn();
    render(<KdsRail orders={orders} tables={tables} monitorKind="kitchen" tenantSlaMinutes={18} now={NOW} onAdvanceStatus={onAdvance} />);
    fireEvent.click(within(screen.getByTestId('rail-ticket-nuevo')).getByRole('button', { name: /Avanzar/i }));
    expect(onAdvance).toHaveBeenCalledWith('nuevo', 'IN_KITCHEN');
    fireEvent.click(within(screen.getByTestId('rail-ticket-viejo')).getByRole('button', { name: /Avanzar/i }));
    expect(onAdvance).toHaveBeenCalledWith('viejo', 'READY');
    fireEvent.click(within(screen.getByTestId('rail-ticket-listo')).getByRole('button', { name: /Avanzar/i }));
    expect(onAdvance).toHaveBeenCalledWith('listo', 'DELIVERED');
  });

  test('muestra el conteo por plato pendiente y ninguna cifra de ventas', () => {
    render(<KdsRail orders={orders} tables={tables} monitorKind="kitchen" tenantSlaMinutes={18} now={NOW} />);
    const allDay = screen.getByTestId('kds-all-day');
    expect(within(allDay).getByText('Tiramisu')).toBeInTheDocument();
    expect(within(allDay).getByText('×3', { selector: '[data-testid="all-day-qty-Tiramisu"]' })).toBeInTheDocument();
    expect(screen.queryByText(/ventas|ticket promedio|\$/i)).not.toBeInTheDocument();
  });

  test('sin tickets muestra un estado vacío', () => {
    render(<KdsRail orders={[]} tables={tables} monitorKind="bar" tenantSlaMinutes={18} now={NOW} />);
    expect(screen.getByText(/Sin tickets/i)).toBeInTheDocument();
  });
});
