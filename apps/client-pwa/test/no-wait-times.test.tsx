import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { OrderConfirmationCard } from '../src/components/cart/OrderConfirmationCard';
import type { OrderDTO } from '@packages/shared-types';

const order: OrderDTO = {
  id: 'ord-wait-1',
  tenantId: 't1',
  sessionId: 's1',
  tableId: 'tb1',
  status: 'IN_KITCHEN',
  total: 20,
  items: [],
  estimatedMinutes: 25,
  delayMinutes: 10,
  createdAt: new Date().toISOString(),
} as OrderDTO;

describe('La PWA no muestra tiempos de espera al comensal', () => {
  test('ni la demora ni el tiempo estimado aparecen en el seguimiento del pedido', () => {
    const { container } = render(<OrderConfirmationCard order={order} />);
    expect(screen.queryByTestId('order-delay-notice')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d+\s*min/i);
    expect(container.textContent).not.toMatch(/demora/i);
  });
});
