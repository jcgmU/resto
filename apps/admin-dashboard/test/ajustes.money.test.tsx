import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AjustesView } from '../src/app/(panel)/ajustes/page';
import { MoneyProvider } from '../src/lib/money';
import { ApiClient } from '../src/lib/api';

const makeJwt = (role: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ userId: 'u1', tenantId: 't1', role })).toString('base64');
  return `${header}.${payload}.signature`;
};

describe('Ajustes: moneda y locale', () => {
  const originalRequest = ApiClient.request;
  const originalListTeam = ApiClient.listTeam;
  let settings: { currency: string; locale: string };

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    ApiClient.token = makeJwt('ADMIN');
    settings = { currency: 'COP', locale: 'es-CO' };
    ApiClient.listTeam = jest.fn().mockResolvedValue({ data: [] });
    ApiClient.request = jest.fn(async (path: string, options?: any) => {
      if (path === '/v1/tenant/settings' && options?.method === 'PATCH') {
        const body = JSON.parse(options.body);
        if (body.currency === 'XXX') throw new Error('Moneda inválida');
        settings = { ...settings, ...body };
        return { data: settings };
      }
      return { data: { invoiceMode: 'simple', ...settings } };
    });
  });

  afterEach(() => {
    ApiClient.request = originalRequest;
    ApiClient.listTeam = originalListTeam;
  });

  const renderView = () => render(<MoneyProvider><AjustesView /></MoneyProvider>);

  it('guarda moneda y locale con PATCH y refresca el provider', async () => {
    renderView();
    const select = await screen.findByLabelText('Moneda');
    fireEvent.change(select, { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText(/Idioma y región/), { target: { value: 'en-US' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar formato' }));

    await waitFor(() =>
      expect(ApiClient.request).toHaveBeenCalledWith('/v1/tenant/settings', {
        method: 'PATCH',
        body: JSON.stringify({ currency: 'USD', locale: 'en-US' }),
      })
    );
    expect(await screen.findByText('Moneda y formato actualizados.')).toBeInTheDocument();
    const gets = (ApiClient.request as jest.Mock).mock.calls.filter(
      (c) => c[0] === '/v1/tenant/settings' && !c[1]
    );
    expect(gets.length).toBeGreaterThanOrEqual(3);
  });

  it('un locale inválido bloquea el envío y muestra el mensaje', async () => {
    renderView();
    await screen.findByLabelText('Moneda');
    fireEvent.change(screen.getByLabelText(/Idioma y región/), { target: { value: 'no es locale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar formato' }));
    expect(await screen.findByText(/no es válido/)).toBeInTheDocument();
    const patches = (ApiClient.request as jest.Mock).mock.calls.filter((c) => c[1]?.method === 'PATCH');
    expect(patches).toHaveLength(0);
  });

  it('muestra el error del servidor (400)', async () => {
    renderView();
    const select = await screen.findByLabelText('Moneda');
    const option = document.createElement('option');
    option.value = 'XXX';
    select.appendChild(option);
    fireEvent.change(select, { target: { value: 'XXX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar formato' }));
    expect(await screen.findByText('Moneda inválida')).toBeInTheDocument();
  });
});
