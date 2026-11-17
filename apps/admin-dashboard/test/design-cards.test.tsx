import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TableCard, TableMapSlot } from '../src/components/mesas/TableCard';
import { ProductCard } from '../src/components/ProductCard';

const table = { tableId: 't1', label: 'Mesa 1', status: 'ACTIVE', createdAt: '' };
const statusInfo = { label: 'Ocupada', tone: 'error', slotStatus: 'ocupada' } as const;

test.each([TableCard, TableMapSlot])('la mesa muestra su estado una vez en una tarjeta compartida', (Component) => {
  const { container } = render(<Component table={table} statusInfo={statusInfo} onViewQr={() => {}} />);
  expect(container.querySelector('[data-component="status-card"][data-status="occupied"]')).toBeTruthy();
  expect(screen.getAllByText('Ocupada')).toHaveLength(1);
  expect(container.querySelector('[data-component="status-chip"]')).toBeNull();
});

test('el producto usa solo el control de disponibilidad y permite alternar', () => {
  const onChange = jest.fn();
  render(<ProductCard product={{ id: 'p1', name: 'Plato', price: 100, categoryId: 'c1', isAvailable: true }} onAvailabilityChange={onChange} />);
  expect(screen.queryByTestId('availability-badge')).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: /disponible/i }));
  expect(onChange).toHaveBeenCalledWith(false);
});

test.each([TableCard, TableMapSlot])('las acciones de mesa no parten sus etiquetas y pueden pasar a otra fila', (Component) => {
  render(<Component table={table} statusInfo={statusInfo} onViewQr={() => {}} canMutate onEdit={() => {}} onDelete={() => {}} />);
  const qr = screen.getByRole('button', { name: 'Ver QR' });
  for (const button of [qr, screen.getByRole('button', { name: 'Editar Mesa 1' }), screen.getByRole('button', { name: 'Eliminar Mesa 1' })]) {
    expect(button).toHaveStyle({ whiteSpace: 'nowrap' });
  }
  expect(qr.parentElement).toHaveStyle({ flexWrap: 'wrap' });
});
