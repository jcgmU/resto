import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AjustesView } from '../src/app/(panel)/ajustes/page';
import { ApiClient } from '../src/lib/api';

describe('U7 & U9: Ajustes - Gestión de Equipo y Cambio de Contraseña', () => {
  const originalListTeam = ApiClient.listTeam;
  const originalCreateTeamMember = ApiClient.createTeamMember;
  const originalUpdateTeamMember = ApiClient.updateTeamMember;
  const originalSetTeamMemberActive = ApiClient.setTeamMemberActive;
  const originalResetPassword = ApiClient.resetTeamMemberPassword;
  const originalChangePassword = ApiClient.changePassword;
  const originalRequest = ApiClient.request;

  // Helper to build mock JWT
  const makeJwt = (role: string) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ userId: 'u-current', tenantId: 't1', role })).toString('base64');
    return `${header}.${payload}.signature`;
  };

  const mockTeam = [
    { id: 'u-admin', tenantId: 't1', email: 'admin@resto.com', displayName: 'Admin Boss', role: 'ADMIN', status: 'ACTIVE' },
    { id: 'u-staff', tenantId: 't1', email: 'staff@resto.com', displayName: 'Mesero Pedro', role: 'WAITER', status: 'ACTIVE' },
    { id: 'u-disabled', tenantId: 't1', email: 'disabled@resto.com', displayName: 'Ex Mesero', role: 'WAITER', status: 'DISABLED' },
  ];

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    ApiClient.token = makeJwt('ADMIN');

    ApiClient.request = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.listTeam = jest.fn().mockResolvedValue({ status: 200, data: mockTeam });
    ApiClient.createTeamMember = jest.fn().mockResolvedValue({ status: 201, data: {} });
    ApiClient.updateTeamMember = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.setTeamMemberActive = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.resetTeamMemberPassword = jest.fn().mockResolvedValue({ status: 200, data: { password: 'TempPass123!' } });
    ApiClient.changePassword = jest.fn().mockResolvedValue({ status: 200, data: {} });
  });

  afterEach(() => {
    ApiClient.request = originalRequest;
    ApiClient.listTeam = originalListTeam;
    ApiClient.createTeamMember = originalCreateTeamMember;
    ApiClient.updateTeamMember = originalUpdateTeamMember;
    ApiClient.setTeamMemberActive = originalSetTeamMemberActive;
    ApiClient.resetTeamMemberPassword = originalResetPassword;
    ApiClient.changePassword = originalChangePassword;
    jest.restoreAllMocks();
  });

  const actionBtn = (row: HTMLElement, label: string) =>
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === label);

  test('distingue la contraseña inicial del empleado y el cambio de contraseña propio', async () => {
    render(<AjustesView />);
    await screen.findByText('Mesero Pedro');
    fireEvent.click(screen.getByTestId('toggle-new-employee-button'));
    expect(screen.getByTestId('employee-password-input')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Nueva contraseña (mínimo 8 caracteres)')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveAttribute('autocomplete', 'new-password');
  });

  describe('ADMIN: sección Equipo de Trabajo con acciones', () => {
    test('1. Lista los miembros con nombre, email, rol y StatusChip', async () => {
      render(<AjustesView />);
      await waitFor(() => expect(screen.getByText('Mesero Pedro')).toBeInTheDocument());
      expect(screen.getByText('admin@resto.com')).toBeInTheDocument();
      expect(screen.getAllByText('Activo').length).toBe(2);
      expect(screen.getByText('Inactivo')).toBeInTheDocument();
      expect(ApiClient.listTeam).toHaveBeenCalled();
    });

    test('2. Rol abre el modal con los 5 roles operativos y actualiza vía updateTeamMember', async () => {
      render(<AjustesView />);
      await waitFor(() => expect(screen.getByText('Mesero Pedro')).toBeInTheDocument());

      fireEvent.click(actionBtn(screen.getByTestId('employee-row-u-staff'), 'Rol')!);
      expect(screen.getByText('Cambiar rol')).toBeInTheDocument();
      expect(screen.getByRole('dialog').querySelectorAll('input[name="roleSelect"]')).toHaveLength(5);

      fireEvent.click(screen.getByLabelText(/MANAGER/i));
      fireEvent.click(screen.getByRole('button', { name: /Guardar rol/i }));

      await waitFor(() => {
        expect(ApiClient.updateTeamMember).toHaveBeenCalledWith('u-staff', { role: 'MANAGER' });
      });
    });

    test('3. Desactivar usa ModalConfirm y llama setTeamMemberActive(false)', async () => {
      render(<AjustesView />);
      await waitFor(() => expect(screen.getByText('Mesero Pedro')).toBeInTheDocument());

      fireEvent.click(actionBtn(screen.getByTestId('employee-row-u-staff'), 'Desactivar')!);
      expect(screen.getByText('¿Desactivar usuario?')).toBeInTheDocument();

      const dialog = screen.getByRole('dialog');
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Desactivar');
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(ApiClient.setTeamMemberActive).toHaveBeenCalledWith('u-staff', false);
      });
    });

    test('4. Activar usa ModalConfirm y llama setTeamMemberActive(true)', async () => {
      render(<AjustesView />);
      await waitFor(() => expect(screen.getByText('Ex Mesero')).toBeInTheDocument());

      fireEvent.click(actionBtn(screen.getByTestId('employee-row-u-disabled'), 'Activar')!);
      expect(screen.getByText('¿Reactivar usuario?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Reactivar$/i }));

      await waitFor(() => {
        expect(ApiClient.setTeamMemberActive).toHaveBeenCalledWith('u-disabled', true);
      });
    });

    test('5. Clave abre modal y llama resetTeamMemberPassword', async () => {
      render(<AjustesView />);
      await waitFor(() => expect(screen.getByText('Mesero Pedro')).toBeInTheDocument());

      fireEvent.click(actionBtn(screen.getByTestId('employee-row-u-staff'), 'Clave')!);
      expect(screen.getByText('Restablecer contraseña')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Restablecer$/i }));

      await waitFor(() => {
        expect(ApiClient.resetTeamMemberPassword).toHaveBeenCalledWith('u-staff', undefined);
      });
    });
  });

  describe('MANAGER y WAITER: acceso por rol y cambio de contraseña', () => {
    test('6. MANAGER lee la lista de empleados pero no ve acciones ni alta', async () => {
      ApiClient.token = makeJwt('MANAGER');
      render(<AjustesView />);

      await waitFor(() => expect(screen.getByText('Mesero Pedro')).toBeInTheDocument());
      expect(screen.queryByTestId('toggle-new-employee-button')).not.toBeInTheDocument();
      const row = screen.getByTestId('employee-row-u-staff');
      expect(row.querySelectorAll('button')).toHaveLength(0);
      expect(screen.getByText('Cambiar mi Contraseña')).toBeInTheDocument();
    });

    test('7. WAITER no ve Equipo de Trabajo ni consulta la lista', async () => {
      ApiClient.token = makeJwt('WAITER');
      render(<AjustesView />);

      expect(screen.queryByText('Equipo de Trabajo')).not.toBeInTheDocument();
      expect(screen.getByText('Cambiar mi Contraseña')).toBeInTheDocument();
      expect(ApiClient.listTeam).not.toHaveBeenCalled();
    });

    test('8. Cambiar mi contraseña: error al no coincidir y éxito al corregir', async () => {
      ApiClient.token = makeJwt('WAITER');
      render(<AjustesView />);

      fireEvent.change(screen.getByLabelText(/Contraseña actual/i), { target: { value: 'claveactual123' } });
      fireEvent.change(screen.getByLabelText(/Nueva contraseña \(mínimo 8 caracteres\)/i), {
        target: { value: 'nuevaclave123' },
      });
      fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), { target: { value: 'otra-diferente' } });
      fireEvent.click(screen.getByRole('button', { name: /Actualizar contraseña/i }));

      expect(screen.getByText(/Las nuevas contraseñas no coinciden/i)).toBeInTheDocument();
      expect(ApiClient.changePassword).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), { target: { value: 'nuevaclave123' } });
      fireEvent.click(screen.getByRole('button', { name: /Actualizar contraseña/i }));

      await waitFor(() => {
        expect(ApiClient.changePassword).toHaveBeenCalledWith({
          currentPassword: 'claveactual123',
          newPassword: 'nuevaclave123',
        });
      });
    });
  });
});
