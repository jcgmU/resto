import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TerminalShell from '../src/app/(terminal)/TerminalShell';
import { ApiClient } from '../src/lib/api';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockPathname = '/terminal-mesero';

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

const TERMINALS = [
  { role: 'WAITER', path: '/terminal-mesero' },
  { role: 'CASHIER', path: '/terminal-caja' },
  { role: 'MONITOR', path: '/monitor' },
];

describe('Cambio de contraseña desde las terminales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    ApiClient.token = 'valid-token';
    jest.spyOn(ApiClient, 'changePassword').mockResolvedValue({} as never);
  });

  test.each(TERMINALS)('$role cambia su clave desde $path', async ({ role, path }) => {
    mockPathname = path;
    localStorage.setItem('resto_user', JSON.stringify({ id: 'u1', role, displayName: 'Usuario', monitorKind: 'kitchen' }));
    render(
      <TerminalShell>
        <div>pantalla</div>
      </TerminalShell>
    );

    fireEvent.click(await screen.findByRole('button', { name: /Cambiar contraseña/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), { target: { value: 'claveactual1' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/i), { target: { value: 'nuevaclave99' } });
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), { target: { value: 'otradistinta' } });
    fireEvent.click(screen.getByRole('button', { name: /Actualizar contraseña/i }));
    expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
    expect(ApiClient.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), { target: { value: 'nuevaclave99' } });
    fireEvent.click(screen.getByRole('button', { name: /Actualizar contraseña/i }));

    await waitFor(() =>
      expect(ApiClient.changePassword).toHaveBeenCalledWith({
        currentPassword: 'claveactual1',
        newPassword: 'nuevaclave99',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
