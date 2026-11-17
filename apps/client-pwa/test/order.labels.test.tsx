import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { OrderConfirmationCard } from '../src/components/cart/OrderConfirmationCard';
import { OrderDTO } from '@packages/shared-types';

describe('U24 (H7): Enums e IDs crudos en OrderConfirmationCard a español', () => {
  const baseOrder: OrderDTO = {
    id: 'ord-zc8lj',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 't-1',
    status: 'PLACED',
    total: 20,
    items: [],
    createdAt: new Date().toISOString(),
  };

  test('la confirmación usa tarjeta de estado compartida sin punto de estado', () => {
    const { container } = render(<OrderConfirmationCard order={baseOrder} />);
    expect(container.querySelector('[data-component="status-card"]')).toBeInTheDocument();
    expect(container.querySelector('[data-component="status-chip"]')).not.toBeInTheDocument();
    expect(screen.getByTestId('order-status')).toHaveTextContent('Recibido');
  });

  test('StatusChip muestra "Recibido" en vez del enum PLACED', () => {
    const { container } = render(<OrderConfirmationCard order={{ ...baseOrder, status: 'PLACED' }} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('Recibido');
    expect(chip).not.toHaveTextContent('PLACED');
  });

  test('StatusChip muestra "En cocina" en vez del enum IN_KITCHEN', () => {
    const { container } = render(<OrderConfirmationCard order={{ ...baseOrder, status: 'IN_KITCHEN' }} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('En cocina');
    expect(chip).not.toHaveTextContent('IN_KITCHEN');
  });

  test('StatusChip muestra "Listo" en vez del enum READY', () => {
    const { container } = render(<OrderConfirmationCard order={{ ...baseOrder, status: 'READY' }} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('Listo');
    expect(chip).not.toHaveTextContent('READY');
  });

  test('StatusChip muestra "Entregado" en vez del enum DELIVERED', () => {
    const { container } = render(<OrderConfirmationCard order={{ ...baseOrder, status: 'DELIVERED' }} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('Entregado');
    expect(chip).not.toHaveTextContent('DELIVERED');
  });

  test('StatusChip muestra "Cancelado" en vez del enum CANCELLED', () => {
    const { container } = render(<OrderConfirmationCard order={{ ...baseOrder, status: 'CANCELLED' }} />);
    const chip = container.querySelector('[data-testid="order-status"]');
    expect(chip).toHaveTextContent('Cancelado');
    expect(chip).not.toHaveTextContent('CANCELLED');
  });

  test('Número de orden formatea con formatOrderNumber evitando #-zc8lj', () => {
    render(<OrderConfirmationCard order={baseOrder} />);
    expect(screen.getByText('Orden #zc8lj')).toBeInTheDocument();
    expect(screen.queryByText(/#-zc8lj/)).not.toBeInTheDocument();
  });
});
