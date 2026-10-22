import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import PanelShell from '../src/app/(panel)/PanelShell';
import TerminalShell from '../src/app/(terminal)/TerminalShell';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let currentPathname = '/dashboard';

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => currentPathname,
}));

describe('U6 [R2]: Gating por rol y perfiles de terminal', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'valid-token';
    currentPathname = '/dashboard';
    jest.clearAllMocks();
  });

  test('1. Usuario WAITER en panel admin es redirigido a /terminal-mesero', async () => {
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-w', email: 'mesero@resto.com', displayName: 'Carlos Mesero', role: 'WAITER' })
    );

    render(
      <PanelShell>
        <div>Contenido Protegido</div>
      </PanelShell>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/terminal-mesero');
    });
  });

  test('2. Usuario CASHIER en panel admin es redirigido a /terminal-caja', async () => {
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-c', email: 'caja@resto.com', displayName: 'Laura Caja', role: 'CASHIER' })
    );

    render(
      <PanelShell>
        <div>Contenido Protegido</div>
      </PanelShell>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/terminal-caja');
    });
  });

  test('3. Usuario MONITOR en panel admin es redirigido a /monitor', async () => {
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-m', email: 'monitor@resto.com', displayName: 'Monitor Cocina', role: 'MONITOR', monitorKind: 'kitchen' })
    );

    render(
      <PanelShell>
        <div>Contenido Protegido</div>
      </PanelShell>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/monitor');
    });
  });

  test('4. Usuario ADMIN o MANAGER permanece en el panel y ve los módulos completos', async () => {
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-a', email: 'admin@resto.com', displayName: 'Don Admin', role: 'ADMIN' })
    );

    render(
      <PanelShell>
        <div>Contenido Protegido</div>
      </PanelShell>
    );

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByText('Contenido Protegido')).toBeInTheDocument();
      expect(screen.getByText('Don Admin')).toBeInTheDocument();
      expect(screen.getAllByText('Resumen y Mesas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gestión del Menú').length).toBeGreaterThan(0);
    });
  });

  test('5. TerminalShell muestra "Monitor de Bar" para usuario monitor con monitorKind=bar', async () => {
    currentPathname = '/monitor';
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-mb', email: 'bar@resto.com', displayName: 'Bartender Alex', role: 'MONITOR', monitorKind: 'bar' })
    );

    render(
      <TerminalShell>
        <div>Vista KDS Bar</div>
      </TerminalShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId('terminal-header-title')).toHaveTextContent('Monitor de Bar');
      expect(screen.getByText('Bartender Alex')).toBeInTheDocument();
      expect(screen.getByText('Vista KDS Bar')).toBeInTheDocument();
    });
  });

  test('6. TerminalShell muestra "Terminal de Mesero" y "Terminal de Caja" según ruta', async () => {
    currentPathname = '/terminal-mesero';
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-w', email: 'mesero@resto.com', displayName: 'Carlos Mesero', role: 'WAITER' })
    );

    const { rerender } = render(
      <TerminalShell>
        <div>Vista Mesero</div>
      </TerminalShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId('terminal-header-title')).toHaveTextContent('Terminal de Mesero');
      expect(screen.getByText('Carlos Mesero')).toBeInTheDocument();
      expect(screen.getByText('Mesero')).toBeInTheDocument();
    });

    currentPathname = '/terminal-caja';
    rerender(
      <TerminalShell>
        <div>Vista Caja</div>
      </TerminalShell>
    );

    await waitFor(() => {
      expect(screen.getByTestId('terminal-header-title')).toHaveTextContent('Terminal de Caja');
    });
  });
});
