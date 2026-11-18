import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { AjustesView } from '../src/app/(panel)/ajustes/page';
import { ApiClient } from '../src/lib/api';
import * as menuApi from '../src/lib/api/menu';

const makeJwt = (role: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ userId: 'u-current', tenantId: 't1', role })).toString('base64');
  return `${header}.${payload}.signature`;
};

const team = [
  { id: 'u-1', tenantId: 't1', email: 'carlos@resto.com', displayName: 'Carlos Mesero', role: 'WAITER', status: 'ACTIVE', avatarUrl: '/v1/uploads/carlos.jpg' },
  { id: 'u-2', tenantId: 't1', email: 'laura@resto.com', displayName: 'Laura Caja', role: 'CASHIER', status: 'ACTIVE' },
];

describe('Foto de perfil del equipo en /ajustes', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    ApiClient.token = makeJwt('ADMIN');
    ApiClient.request = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.listTeam = jest.fn().mockResolvedValue({ status: 200, data: team });
    ApiClient.updateTeamMember = jest.fn().mockResolvedValue({ status: 200, data: {} });
  });

  afterEach(() => jest.restoreAllMocks());

  test('cada fila muestra la foto o, sin foto, las iniciales', async () => {
    render(<AjustesView />);
    await waitFor(() => expect(screen.getByText('Carlos Mesero')).toBeInTheDocument());
    const carlos = screen.getByTestId('employee-row-u-1');
    expect(within(carlos).getByRole('img', { name: 'Carlos Mesero' })).toHaveAttribute('src', expect.stringContaining('carlos.jpg'));
    const laura = screen.getByTestId('employee-row-u-2');
    expect(within(laura).getByText('LC')).toBeInTheDocument();
  });

  test('el admin sube una foto para un empleado: sube el archivo y guarda avatarUrl', async () => {
    const upload = jest.spyOn(menuApi, 'uploadProductImage').mockResolvedValue({ url: '/v1/uploads/nueva.png' });
    render(<AjustesView />);
    await waitFor(() => expect(screen.getByText('Laura Caja')).toBeInTheDocument());

    fireEvent.click(within(screen.getByTestId('employee-row-u-2')).getByRole('button', { name: 'Foto' }));
    const dialog = await screen.findByRole('dialog', { name: /Foto de Laura Caja/i });

    const file = new File(['x'], 'laura.png', { type: 'image/png' });
    fireEvent.change(within(dialog).getByLabelText(/Archivo de foto/i), { target: { files: [file] } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Guardar foto/i }));

    await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(ApiClient.updateTeamMember).toHaveBeenCalledWith('u-2', { avatarUrl: '/v1/uploads/nueva.png' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('se puede quitar la foto de quien la tiene', async () => {
    render(<AjustesView />);
    await waitFor(() => expect(screen.getByText('Carlos Mesero')).toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId('employee-row-u-1')).getByRole('button', { name: 'Foto' }));
    const dialog = await screen.findByRole('dialog', { name: /Foto de Carlos Mesero/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Quitar foto/i }));
    await waitFor(() => expect(ApiClient.updateTeamMember).toHaveBeenCalledWith('u-1', { avatarUrl: null }));
  });

  test('sin archivo no se puede guardar', async () => {
    render(<AjustesView />);
    await waitFor(() => expect(screen.getByText('Laura Caja')).toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId('employee-row-u-2')).getByRole('button', { name: 'Foto' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Guardar foto/i })).toBeDisabled();
  });
});
