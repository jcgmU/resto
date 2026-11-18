import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';
import DashboardPage from '../src/app/(panel)/dashboard/page';
import { ApiClient } from '../src/lib/api';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

const provider = new StaticFeatureFlagProvider({ analytics: true });
const originalRequest = ApiClient.request;

function setup(report: () => Promise<unknown>, role = 'ADMIN') {
  ApiClient.token = 'mock-admin-token';
  localStorage.setItem('resto_user', JSON.stringify({ role }));
  ApiClient.request = jest.fn(async (path: string) => {
    if (path.startsWith('/v1/reports/sales/today?')) return report();
    if (path === '/v1/tenant/settings') return { operatingMode: 'hybrid', estimatedPrepMinutes: 18 };
    return [];
  });
  return render(<FeatureFlagProviderRoot provider={provider}><DashboardPage /></FeatureFlagProviderRoot>);
}

afterEach(() => { ApiClient.request = originalRequest; localStorage.removeItem('resto_user'); });

test('carga el reporte con zona horaria y muestra ventas y promedio en tarjetas', async () => {
  let resolveReport!: (value: unknown) => void;
  const report = new Promise((resolve) => { resolveReport = resolve; });
  setup(() => report);
  expect(await screen.findByLabelText(/cargando ventas/i)).toBeInTheDocument();
  await act(async () => resolveReport({ total: '123456.78', tickets: 2, averageTicket: '61728.39' }));
  const totalCard = (await screen.findByText('Ventas del Día')).closest('[data-component="status-card"]');
  const averageCard = screen.getByText('Ticket Promedio').closest('[data-component="status-card"]');
  expect(totalCard).not.toBeNull();
  expect(averageCard).not.toBeNull();
  const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  expect(totalCard?.textContent).toContain(currency.format(123456.78));
  expect(averageCard?.textContent).toContain(currency.format(61728.39));
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(ApiClient.request).toHaveBeenCalledWith(expect.stringContaining(`tz=${encodeURIComponent(zone)}`));
});

test('cuando no hay pagos informa el estado vacío sin mostrar NaN', async () => {
  setup(async () => ({ total: '0.00', tickets: 0, averageTicket: '0.00' }));
  expect(await screen.findByText('Sin ventas hoy')).toBeInTheDocument();
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
});

test('ofrece reintento y actualiza el reporte al volver a la pestaña', async () => {
  const report = jest.fn()
    .mockRejectedValueOnce(new Error('No disponible'))
    .mockResolvedValueOnce({ total: '1000.00', tickets: 1, averageTicket: '1000.00' })
    .mockResolvedValue({ total: '3000.00', tickets: 2, averageTicket: '1500.00' });
  setup(report);
  expect(await screen.findByText(/no se pudieron cargar las ventas/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
  await waitFor(() => expect(report).toHaveBeenCalledTimes(2));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(report).toHaveBeenCalledTimes(3));
  expect(await screen.findByText(/3[.,]000/)).toBeInTheDocument();
});

test('no solicita ni muestra ventas a un mesero', async () => {
  const report = jest.fn(async () => ({ total: '1000.00', tickets: 1, averageTicket: '1000.00' }));
  setup(report, 'WAITER');
  await screen.findByText('Resumen Operativo');
  expect(report).not.toHaveBeenCalled();
  expect(screen.queryByText('Ventas del Día')).not.toBeInTheDocument();
});
