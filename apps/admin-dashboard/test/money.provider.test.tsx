import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { MoneyProvider, useMoney } from '../src/lib/money';
import { ApiClient } from '../src/lib/api';
import { SalesSummary } from '../src/components/SalesSummary';

const Probe = () => {
  const { format, currency, locale } = useMoney();
  return (
    <div>
      <span data-testid="amount">{format(1234.5)}</span>
      <span data-testid="meta">{currency}|{locale}</span>
    </div>
  );
};

describe('MoneyProvider', () => {
  const originalRequest = ApiClient.request;
  afterEach(() => {
    ApiClient.request = originalRequest;
  });

  it('sin provider usa COP/es-CO', () => {
    render(<Probe />);
    expect(screen.getByTestId('meta')).toHaveTextContent('COP|es-CO');
    expect(screen.getByTestId('amount').textContent).toMatch(/1\.235/);
  });

  it('carga USD/en-US y formatea $1,234.50', async () => {
    ApiClient.request = jest.fn().mockResolvedValue({ data: { currency: 'USD', locale: 'en-US' } });
    render(<MoneyProvider><Probe /></MoneyProvider>);
    expect(screen.getByTestId('meta')).toHaveTextContent('COP|es-CO');
    await waitFor(() => expect(screen.getByTestId('amount')).toHaveTextContent('$1,234.50'));
    expect(screen.getByTestId('meta')).toHaveTextContent('USD|en-US');
    expect(ApiClient.request).toHaveBeenCalledTimes(1);
    expect(ApiClient.request).toHaveBeenCalledWith('/v1/tenant/settings');
  });

  it('si falla la lectura mantiene COP', async () => {
    ApiClient.request = jest.fn().mockRejectedValue(new Error('403'));
    render(<MoneyProvider><Probe /></MoneyProvider>);
    await waitFor(() => expect(ApiClient.request).toHaveBeenCalled());
    expect(screen.getByTestId('meta')).toHaveTextContent('COP|es-CO');
  });

  it('SalesSummary muestra USD cuando el provider lo entrega', async () => {
    ApiClient.token = 'mock-admin-token';
    localStorage.setItem('resto_user', JSON.stringify({ role: 'ADMIN' }));
    ApiClient.request = jest.fn(async (path: string) => {
      if (path === '/v1/tenant/settings') return { data: { currency: 'USD', locale: 'en-US' } };
      return { total: '1234.50', tickets: 2, averageTicket: '617.25' };
    });
    render(<MoneyProvider><SalesSummary /></MoneyProvider>);
    await waitFor(() => expect(screen.getByText('$1,234.50')).toBeInTheDocument());
    localStorage.removeItem('resto_user');
  });
});
