import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductDTO, CartItemDTO } from '@packages/shared-types';
import { MoneyProvider, useMoney } from '../src/lib/money';
import { PwaApiClient } from '../src/lib/api';
import { ProductListCard } from '../src/components/ProductListCard';
import { CartSummaryBar } from '../src/components/cart/CartSummaryBar';
import { CartLineItem } from '../src/components/cart/CartLineItem';

function Probe({ value = 1234.5 }: { value?: number }) {
  const { format, currency, locale } = useMoney();
  return <div data-testid="probe">{`${format(value)}|${currency}|${locale}`}</div>;
}

describe('M4: MoneyProvider y useMoney', () => {
  afterEach(() => jest.restoreAllMocks());

  test('sin provider usa COP/es-CO', () => {
    render(<Probe value={15000} />);
    expect(screen.getByTestId('probe').textContent).toBe(
      `${require('@packages/shared-types').formatCOP(15000)}|COP|es-CO`,
    );
  });

  test('mientras carga usa fallback COP y luego aplica USD/en-US', async () => {
    jest
      .spyOn(PwaApiClient, 'getTenantSettings')
      .mockResolvedValue({ operatingMode: 'hybrid', currency: 'USD', locale: 'en-US' });

    render(
      <MoneyProvider>
        <Probe />
      </MoneyProvider>,
    );

    expect(screen.getByTestId('probe').textContent).toMatch(/\|COP\|es-CO$/);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('$1,234.50|USD|en-US'));
  });

  test('si la carga falla o no trae moneda conserva COP/es-CO', async () => {
    const spy = jest.spyOn(PwaApiClient, 'getTenantSettings').mockRejectedValue(new Error('x'));
    render(
      <MoneyProvider>
        <Probe />
      </MoneyProvider>,
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('probe').textContent).toMatch(/\|COP\|es-CO$/);
  });

  test('lee los settings una sola vez', async () => {
    const spy = jest
      .spyOn(PwaApiClient, 'getTenantSettings')
      .mockResolvedValue({ currency: 'USD', locale: 'en-US' });
    const { rerender } = render(
      <MoneyProvider>
        <Probe />
      </MoneyProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toContain('USD'));
    rerender(
      <MoneyProvider>
        <Probe value={2} />
      </MoneyProvider>,
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('M4: componentes muestran la moneda del tenant', () => {
  beforeEach(() => {
    jest
      .spyOn(PwaApiClient, 'getTenantSettings')
      .mockResolvedValue({ currency: 'USD', locale: 'en-US' });
  });
  afterEach(() => jest.restoreAllMocks());

  test('ProductListCard muestra USD', async () => {
    const product = {
      id: 'p1',
      tenantId: 't1',
      categoryId: 'c1',
      name: 'Burger',
      price: 1234.5,
      isAvailable: true,
    } as unknown as ProductDTO;
    render(
      <MoneyProvider>
        <ProductListCard product={product} />
      </MoneyProvider>,
    );
    await waitFor(() => expect(screen.getByText(/\$1,234\.50/)).toBeInTheDocument());
  });

  test('CartSummaryBar y CartLineItem muestran USD', async () => {
    const item = {
      id: 'i1',
      productId: 'p1',
      productName: 'Burger',
      quantity: 1,
      unitPrice: 1234.5,
      lineTotal: 1234.5,
      modifiers: [],
    } as unknown as CartItemDTO;
    render(
      <MoneyProvider>
        <CartLineItem item={item} />
        <CartSummaryBar total={2469} />
      </MoneyProvider>,
    );
    await waitFor(() => expect(screen.getAllByText(/\$1,234\.50/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/\$2,469\.00/).length).toBeGreaterThan(0);
  });
});
