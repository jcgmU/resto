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

  // Helper to build mock JWT
  const makeJwt = (role: string) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ userId: 'u-current', tenantId: 't1', role })).toString('base64');
    return `${header}.${payload}.signature`;
  };

  const mockTeam = [
    {
      id: 'u-admin',
      tenantId: 't1',
      email: 'admin@resto.com',
      displayName: 'Admin Boss',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'u-staff',
      tenantId: 't1',
      email: 'staff@resto.com',
      displayName: 'Mesero Pedro',
      role: 'STAFF' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'u-disabled',
      tenantId: 't1',
      email: 'disabled@resto.com',
      displayName: 'Ex Mesero',
      role: 'STAFF' as const,
      status: 'DISABLED' as const,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    ApiClient.token = makeJwt('ADMIN');

    ApiClient.listTeam = jest.fn().mockResolvedValue({ status: 200, data: mockTeam });
    ApiClient.createTeamMember = jest.fn().mockResolvedValue({ status: 201, data: {} });
    ApiClient.updateTeamMember = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.setTeamMemberActive = jest.fn().mockResolvedValue({ status: 200, data: {} });
    ApiClient.resetTeamMemberPassword = jest.fn().mockResolvedValue({ status: 200, data: { password: 'TempPass123!' } });
    ApiClient.changePassword = jest.fn().mockResolvedValue({ status: 200, data: {} });
  });

  afterEach(() => {
    ApiClient.listTeam = originalListTeam;
    ApiClient.createTeamMember = originalCreateTeamMember;
    ApiClient.updateTeamMember = originalUpdateTeamMember;
    ApiClient.setTeamMemberActive = originalSetTeamMemberActive;
    ApiClient.resetTeamMemberPassword = originalResetPassword;
    ApiClient.changePassword = originalChangePassword;
    jest.restoreAllMocks();
  });

  describe('ADMIN: Vista de Equipo (U7)', () => {
    test('1. Lista los miembros del equipo con nombre, email, rol y StatusChip', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Admin Boss')).toBeInTheDocument();
        expect(screen.getByText('Mesero Pedro')).toBeInTheDocument();
        expect(screen.getByText('Ex Mesero')).toBeInTheDocument();
      });

      expect(screen.getByText('admin@resto.com')).toBeInTheDocument();
      expect(screen.getByText('staff@resto.com')).toBeInTheDocument();

      // StatusChips
      expect(screen.getAllByText('Activo').length).toBe(2);
      expect(screen.getByText('Desactivado')).toBeInTheDocument();
    });

    test('2. Abre modal de "Agregar miembro", valida y crea con contraseña inicial', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Admin Boss')).toBeInTheDocument();
      });

      const addBtn = screen.getByRole('button', { name: /\+ Agregar miembro/i });
      fireEvent.click(addBtn);

      expect(screen.getByText('Agregar nuevo miembro')).toBeInTheDocument();

      // Completar campos
      fireEvent.change(screen.getByPlaceholderText(/ejemplo@restaurante.com/i), {
        target: { value: 'nuevo@resto.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Juan Pérez/i), {
        target: { value: 'Nuevo Mesero' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), {
        target: { value: 'nuevapassword123' },
      });

      const submitBtn = screen.getByRole('button', { name: /Crear miembro/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(ApiClient.createTeamMember).toHaveBeenCalledWith({
          email: 'nuevo@resto.com',
          displayName: 'Nuevo Mesero',
          role: 'STAFF',
          password: 'nuevapassword123',
        });
      });
    });

    test('3. Cambiar rol abre modal y actualiza vía ApiClient.updateTeamMember', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Mesero Pedro')).toBeInTheDocument();
      });

      const staffRow = screen.getByTestId('team-row-u-staff');
      const roleBtn = staffRow.querySelector('button'); // Primer botón "Rol"
      expect(roleBtn).toHaveTextContent('Rol');
      fireEvent.click(roleBtn!);

      expect(screen.getByText(/Cambiar rol/i)).toBeInTheDocument();

      // Seleccionar MANAGER
      const managerRadio = screen.getByLabelText(/MANAGER/i);
      fireEvent.click(managerRadio);

      const saveRoleBtn = screen.getByRole('button', { name: /Guardar rol/i });
      fireEvent.click(saveRoleBtn);

      await waitFor(() => {
        expect(ApiClient.updateTeamMember).toHaveBeenCalledWith('u-staff', {
          role: 'MANAGER',
        });
      });
    });

    test('4. Desactivar usuario usa ModalConfirm y llama setTeamMemberActive(false)', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Mesero Pedro')).toBeInTheDocument();
      });

      const staffRow = screen.getByTestId('team-row-u-staff');
      const deactivateBtn = Array.from(staffRow.querySelectorAll('button')).find(
        (b) => b.textContent === 'Desactivar'
      );
      expect(deactivateBtn).toBeDefined();
      fireEvent.click(deactivateBtn!);

      // ModalConfirm visible
      expect(screen.getByText('¿Desactivar usuario?')).toBeInTheDocument();

      // Botón confirmar en ModalConfirm
      const dialog = screen.getByRole('dialog');
      const confirmBtn = dialog.querySelector('button[type="button"]:last-child') ||
        screen.getAllByRole('button', { name: /^Desactivar$/i })[1];
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(ApiClient.setTeamMemberActive).toHaveBeenCalledWith('u-staff', false);
      });
    });

    test('5. Reactivar usuario usa ModalConfirm y llama setTeamMemberActive(true)', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Ex Mesero')).toBeInTheDocument();
      });

      const disabledRow = screen.getByTestId('team-row-u-disabled');
      const activateBtn = Array.from(disabledRow.querySelectorAll('button')).find(
        (b) => b.textContent === 'Activar'
      );
      expect(activateBtn).toBeDefined();
      fireEvent.click(activateBtn!);

      expect(screen.getByText('¿Reactivar usuario?')).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /^Reactivar$/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(ApiClient.setTeamMemberActive).toHaveBeenCalledWith('u-disabled', true);
      });
    });

    test('6. Restablecer contraseña abre modal y llama resetTeamMemberPassword', async () => {
      render(<AjustesView />);

      await waitFor(() => {
        expect(screen.getByText('Mesero Pedro')).toBeInTheDocument();
      });

      const staffRow = screen.getByTestId('team-row-u-staff');
      const claveBtn = Array.from(staffRow.querySelectorAll('button')).find(
        (b) => b.textContent === 'Clave'
      );
      expect(claveBtn).toBeDefined();
      fireEvent.click(claveBtn!);

      expect(screen.getByText('Restablecer contraseña')).toBeInTheDocument();

      const submitResetBtn = screen.getByRole('button', { name: /^Restablecer$/i });
      fireEvent.click(submitResetBtn);

      await waitFor(() => {
        expect(ApiClient.resetTeamMemberPassword).toHaveBeenCalledWith('u-staff', expect.any(String));
      });
    });
  });

  describe('MANAGER / STAFF: Control de Acceso UI y Cambio de Contraseña (U7 & U9)', () => {
    test('7. Usuario con rol MANAGER no ve la pestaña "Equipo"', async () => {
      ApiClient.token = makeJwt('MANAGER');
      render(<AjustesView />);

      // No debe existir el botón/tab de Equipo
      expect(screen.queryByText('Gestión de Equipo')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Equipo/i })).not.toBeInTheDocument();
      expect(screen.getByText('Cambiar mi Contraseña')).toBeInTheDocument();
    });

    test('8. Usuario con rol STAFF no ve la pestaña "Equipo"', async () => {
      ApiClient.token = makeJwt('STAFF');
      render(<AjustesView />);

      expect(screen.queryByText('Gestión de Equipo')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Equipo/i })).not.toBeInTheDocument();
      expect(screen.getByText('Cambiar mi Contraseña')).toBeInTheDocument();
    });

    test('9. Flujo Cambiar mi contraseña (U9): éxito y error al no coincidir', async () => {
      ApiClient.token = makeJwt('STAFF');
      render(<AjustesView />);

      expect(screen.getByText('Cambiar mi Contraseña')).toBeInTheDocument();

      // Error cuando no coinciden las nuevas contraseñas
      fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
        target: { value: 'claveactual123' },
      });
      fireEvent.change(screen.getByLabelText(/Nueva contraseña \(mínimo 8 caracteres\)/i), {
        target: { value: 'nuevaclave123' },
      });
      fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
        target: { value: 'otra-diferente' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Actualizar contraseña/i }));

      expect(screen.getByText(/Las nuevas contraseñas no coinciden/i)).toBeInTheDocument();
      expect(ApiClient.changePassword).not.toHaveBeenCalled();

      // Éxito al corregir la confirmación
      fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
        target: { value: 'nuevaclave123' },
      });
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
