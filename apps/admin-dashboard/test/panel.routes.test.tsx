import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardPage from '../src/app/(panel)/dashboard/page';
import PagosPage from '../src/app/(panel)/pagos/page';
import AjustesPage from '../src/app/(panel)/ajustes/page';
import { ApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot } from '@packages/ui-components';

// Helper to provide feature flags during tests
function renderWithFlags(ui: React.ReactElement, flags: Record<string, boolean> = {}) {
  const mockProvider = {
    isEnabled: (key: string) => Boolean(flags[key]),
    subscribe: () => () => {},
  };
  return render(
    <FeatureFlagProviderRoot provider={mockProvider as any}>
      {ui}
    </FeatureFlagProviderRoot>
  );
}

describe('U10: Admin Dashboard, Pagos y Ajustes', () => {
  const originalRequest = ApiClient.request;

  beforeEach(() => {
    ApiClient.token = 'test-token';
  });

  afterEach(() => {
    ApiClient.request = originalRequest;
    jest.restoreAllMocks();
  });

  describe('/dashboard', () => {
    test('1. Estado Loading: muestra esqueletos mientras se cargan los datos', async () => {
      // Pending promise that never resolves during this check
      ApiClient.request = jest.fn().mockImplementation(() => new Promise(() => {}));

      const { container } = render(<DashboardPage />);
      expect(container.querySelectorAll('[data-component="skeleton"]').length).toBeGreaterThan(0);
    });

    test('2. Estado Error: muestra ErrorState y permite reintentar', async () => {
      ApiClient.request = jest.fn().mockRejectedValue(new Error('Fallo de conexión al gateway'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Fallo de conexión al gateway/i)).toBeInTheDocument();
      });

      // Al reintentar exitosamente
      ApiClient.request = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/sessions')) return { status: 200, data: [] };
        if (url.includes('/v1/tables')) return { status: 200, data: [] };
        if (url.includes('/v1/orders')) return { status: 200, data: [] };
        if (url.includes('/v1/service-calls')) return { status: 200, data: [] };
        return { status: 200, data: [] };
      });

      const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    test('3. Estado OK con datos REALES: muestra KPIs sin tarjeta (KpiDelta) y brief con llamadas pendientes', async () => {
      ApiClient.request = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/sessions?status=active')) {
          return {
            status: 200,
            data: [
              { id: 's1', sessionId: 's1', tableId: 't1', status: 'active' },
              { id: 's2', sessionId: 's2', tableId: 't2', status: 'active' },
            ],
          };
        }
        if (url.includes('/v1/tables')) {
          return {
            status: 200,
            data: [
              { id: 't1', tableId: 't1', label: 'Mesa 1', status: 'active' },
              { id: 't2', tableId: 't2', label: 'Mesa 2', status: 'active' },
              { id: 't3', tableId: 't3', label: 'Mesa 3', status: 'active' },
              { id: 't4', tableId: 't4', label: 'Mesa 4', status: 'active' },
            ],
          };
        }
        if (url.includes('/v1/orders')) {
          return {
            status: 200,
            data: [
              { id: 'o1', status: 'PLACED', total: 20 },
              { id: 'o2', status: 'IN_KITCHEN', total: 35 },
              { id: 'o3', status: 'READY', total: 15 },
              { id: 'o4', status: 'DELIVERED', total: 40 },
              { id: 'o5', status: 'CANCELLED', total: 10 },
            ],
          };
        }
        if (url.includes('/v1/service-calls')) {
          return {
            status: 200,
            data: [
              {
                id: 'sc-1',
                tableId: 't1',
                note: 'Solicita cuenta',
                status: 'pending',
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }
        return { status: 200, data: [] };
      });

      const { container } = render(<DashboardPage />);

      await waitFor(() => {
        // KPI Mesas activas: 2
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(/de 4 mesas/i)).toBeInTheDocument();

        // KPI Pedidos activos: 3 (PLACED, IN_KITCHEN, READY)
        expect(screen.getByText('Pedidos Activos')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      // H2: Los KPIs están envueltos en BentoCard con fondo var(--bento-card-bg-solid)
      const kpis = container.querySelectorAll('[data-component="kpi-delta"]');
      expect(kpis.length).toBeGreaterThanOrEqual(2);
      expect(kpis[0].closest('[data-component="bento-card"]')).not.toBeNull();

      // KPI sin endpoint real (analytics) está protegido tras FeatureGuard mostrando Próximamente
      expect(screen.getAllByTestId('proximamente').length).toBeGreaterThanOrEqual(1);

      // Panel Brief muestra alerta real de servicio
      expect(screen.getByText(/Brief Operativo|Alertas/i)).toBeInTheDocument();
      expect(screen.getByText(/Solicita cuenta/i)).toBeInTheDocument();
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });

    test('4. Estado Empty en brief de alertas: cuando no hay llamadas de servicio abiertas muestra EmptyState', async () => {
      ApiClient.request = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/sessions')) return { status: 200, data: [] };
        if (url.includes('/v1/tables')) return { status: 200, data: [] };
        if (url.includes('/v1/orders')) return { status: 200, data: [] };
        if (url.includes('/v1/service-calls')) return { status: 200, data: [] };
        return { status: 200, data: [] };
      });

      const { container } = render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
      });

      const empty = container.querySelector('[data-component="empty-state"]');
      expect(empty).toBeInTheDocument();
      expect(screen.getByText('Sin alertas activas')).toBeInTheDocument();
    });

    test('5. Flag "analytics" ON: Ventas del Día y Ticket Promedio muestran Próximamente (no $0.00 falso sin endpoint)', async () => {
      ApiClient.request = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/sessions')) return { status: 200, data: [] };
        if (url.includes('/v1/tables')) return { status: 200, data: [] };
        if (url.includes('/v1/orders')) return { status: 200, data: [] };
        if (url.includes('/v1/service-calls')) return { status: 200, data: [] };
        return { status: 200, data: [] };
      });

      renderWithFlags(<DashboardPage />, { analytics: true });

      await waitFor(() => {
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
      });

      expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('proximamente').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Ventas del Día/i)).toBeInTheDocument();
      expect(screen.getByText(/Ticket Promedio/i)).toBeInTheDocument();
    });
  });

  describe('/pagos', () => {
    test('1. Con flag "payments" OFF (por defecto): muestra Proximamente via FeatureGuard', () => {
      renderWithFlags(<PagosPage />, { payments: false });
      expect(screen.getByTestId('proximamente')).toBeInTheDocument();
      expect(screen.getByText(/Próximamente/i)).toBeInTheDocument();
    });

    test('2. Con flag "payments" ON: muestra vista de pagos en BentoCard y sin H1 duplicado', async () => {
      const { container } = renderWithFlags(<PagosPage />, { payments: true });
      expect(screen.queryByRole('heading', { name: /^Pagos$/i, level: 1 })).not.toBeInTheDocument();
      expect(screen.getByText(/Sin historial/i)).toBeInTheDocument();
      expect(container.querySelector('[data-component="bento-card"]')).not.toBeNull();
    });
  });

  describe('/ajustes', () => {
    test('1. Con flag OFF (por defecto): muestra Proximamente via FeatureGuard', () => {
      renderWithFlags(<AjustesPage />, { 'multi-language': false });
      expect(screen.getByTestId('proximamente')).toBeInTheDocument();
      expect(screen.getByText(/Próximamente/i)).toBeInTheDocument();
    });

    test('2. Con flag ON: muestra vista de ajustes en BentoCard y sin H1 duplicado', async () => {
      const { container } = renderWithFlags(<AjustesPage />, { 'multi-language': true });
      expect(screen.queryByRole('heading', { name: /^Ajustes$/i, level: 1 })).not.toBeInTheDocument();
      expect(screen.getByText(/Configuración del Sistema/i)).toBeInTheDocument();
      expect(container.querySelector('[data-component="bento-card"]')).not.toBeNull();
    });

    test('3. Con flag ON: carga y lista empleados en sección Equipo de Trabajo', async () => {
      ApiClient.request = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/identity/users')) {
          return {
            status: 200,
            data: [
              { id: 'u1', displayName: 'Carlos Mesero', email: 'mesero@resto.com', role: 'WAITER', status: 'ACTIVE' },
              { id: 'u2', displayName: 'Monitor Cocina', email: 'monitor@resto.com', role: 'MONITOR', monitorKind: 'kitchen', status: 'ACTIVE' },
              { id: 'u3', displayName: 'Laura Caja', email: 'caja@resto.com', role: 'CASHIER', status: 'ACTIVE' },
            ],
          };
        }
        if (url.includes('/v1/tenant/settings')) {
          return { status: 200, data: { invoiceMode: 'simple' } };
        }
        return { status: 200, data: {} };
      });

      renderWithFlags(<AjustesPage />, { 'multi-language': true });

      await waitFor(() => {
        expect(screen.getByText('Equipo de Trabajo')).toBeInTheDocument();
        expect(screen.getByText('Carlos Mesero')).toBeInTheDocument();
        expect(screen.getByText('Monitor Cocina')).toBeInTheDocument();
        expect(screen.getByText('Laura Caja')).toBeInTheDocument();
      });
    });

    test('4. Con flag ON: formulario permite crear nuevo empleado llamando a POST /v1/identity/users', async () => {
      const mockPost = jest.fn().mockResolvedValue({ status: 201, data: { id: 'u4', displayName: 'Nuevo', email: 'nuevo@resto.com' } });
      ApiClient.request = jest.fn().mockImplementation(async (url: string, opts?: any) => {
        if (url.includes('/v1/identity/users') && opts?.method === 'POST') {
          return mockPost(url, opts);
        }
        if (url.includes('/v1/identity/users')) {
          return { status: 200, data: [] };
        }
        if (url.includes('/v1/tenant/settings')) {
          return { status: 200, data: { invoiceMode: 'simple' } };
        }
        return { status: 200, data: {} };
      });

      renderWithFlags(<AjustesPage />, { 'multi-language': true });

      await waitFor(() => {
        expect(screen.getByTestId('toggle-new-employee-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('toggle-new-employee-button'));
      expect(screen.getByTestId('new-employee-form')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('employee-name-input'), { target: { value: 'Nuevo Mesero' } });
      fireEvent.change(screen.getByTestId('employee-email-input'), { target: { value: 'nuevo@resto.com' } });
      fireEvent.change(screen.getByTestId('employee-password-input'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByTestId('employee-role-select'), { target: { value: 'WAITER' } });

      fireEvent.submit(screen.getByTestId('new-employee-form'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/v1/identity/users',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              displayName: 'Nuevo Mesero',
              email: 'nuevo@resto.com',
              role: 'WAITER',
              password: 'password123',
            }),
          })
        );
      });
    });
  });
});
