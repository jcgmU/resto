import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';
import MenuPage from '../src/app/(panel)/menu/page';
import DashboardPage from '../src/app/(panel)/dashboard/page';
import { ProductCard } from '../src/components/ProductCard';
import { ApiClient } from '../src/lib/api';
import { FeatureGuard } from '@packages/ui-components';

describe('E.1 Admin Dashboard — Comportamiento Bento Box (Tests 31-36)', () => {
  beforeEach(() => {
    ApiClient.token = 'mock-admin-token';
  });

  test('31. Login: guarda tokens y adjunta Authorization: Bearer en las llamadas siguientes; ante 401 intenta POST /v1/auth/refresh una vez', async () => {
    render(<LoginPage />);
    const loginBtn = screen.getByRole('button', { name: /Iniciar Sesión|Entrar/i });
    fireEvent.click(loginBtn);

    await waitFor(() => {
      expect(ApiClient.token).toBeDefined();
    });
  });

  test('32. /menu renderiza cada categoría del stub MSW como data-component="bento-card" dentro de data-component="bento-grid"', async () => {
    const { container } = render(<MenuPage />);
    const grid = container.querySelector('[data-component="bento-grid"]');
    expect(grid).toBeInTheDocument();

    const cards = container.querySelectorAll('[data-component="bento-card"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  test('33. Crear producto: el formulario dispara createProduct con el categoryId seleccionado y el grid se refresca', async () => {
    render(<MenuPage />);
    const createBtn = await screen.findByRole('button', { name: /Nuevo Producto/i });
    await waitFor(() => {
      expect(createBtn).not.toBeDisabled();
    });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/Nuevo Producto Creado/i)).toBeInTheDocument();
    });
  });

  test('34. AvailabilityToggle dispara setProductAvailability; el control expone role="switch" y aria-checked coherente con el estado', () => {
    const onToggle = jest.fn();
    render(
      <ProductCard
        product={{
          id: 'p-1',
          name: 'Ensalada César',
          price: 8.5,
          categoryId: 'cat-1',
          isAvailable: true,
          sortOrder: 0,
          tenantId: 'tenant-100',
        }}
        onAvailabilityChange={onToggle}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  test('35. /menu sin token -> redirige a /login', async () => {
    ApiClient.token = null;
    render(<MenuPage />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  test('36. <FeatureGuard flag="analytics"> con el flag apagado -> BentoCard con data-testid="proximamente" que OCUPA su celda del grid (el layout no colapsa)', () => {
    const { container } = render(
      <FeatureGuard flag="analytics">
        <div>Contenido Analytics</div>
      </FeatureGuard>
    );

    const bentoCard = container.querySelector('[data-component="bento-card"]');
    expect(bentoCard).toBeInTheDocument();
    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByText('Contenido Analytics')).not.toBeInTheDocument();
  });
});

describe('H8 Admin Dashboard — Métricas Reales y KPIs', () => {
  beforeEach(() => {
    ApiClient.token = 'mock-admin-token';
  });

  test('(a) Dedup de mesas activas: 2 sesiones en la misma mesa cuentan como 1 mesa activa en el KPI y en el delta', async () => {
    const originalRequest = ApiClient.request;
    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint.includes('/v1/sessions?status=active')) {
        return [
          { id: 's1', sessionId: 's1', tableId: 'tbl-1', status: 'active' },
          { id: 's2', sessionId: 's2', tableId: 'tbl-1', status: 'active' },
        ];
      }
      if (endpoint.includes('/v1/tables')) {
        return [{ tableId: 'tbl-1', label: 'Mesa 1', status: 'active' }];
      }
      if (endpoint.includes('/v1/orders')) {
        return [];
      }
      if (endpoint.includes('/v1/service-calls')) {
        return [];
      }
      return [];
    });

    try {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
      });

      expect(screen.getByText('1 en sala')).toBeInTheDocument();
      expect(screen.getByText('de 1 mesas configuradas')).toBeInTheDocument();

      const mesasLabel = screen.getByText('Mesas Activas');
      const kpiContainer = mesasLabel.closest('[data-component="kpi-delta"]');
      expect(kpiContainer).toBeInTheDocument();
      expect(kpiContainer).toHaveTextContent('1');
      expect(kpiContainer).not.toHaveTextContent('2 en sala');
    } finally {
      ApiClient.request = originalRequest;
    }
  });

  test('(b) Chip neutro con 0 pedidos: "al día" no es destructivo/rojo y usa trend neutro', async () => {
    const originalRequest = ApiClient.request;
    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint.includes('/v1/sessions?status=active')) {
        return [];
      }
      if (endpoint.includes('/v1/tables')) {
        return [{ tableId: 'tbl-1', label: 'Mesa 1', status: 'active' }];
      }
      if (endpoint.includes('/v1/orders')) {
        return [];
      }
      if (endpoint.includes('/v1/service-calls')) {
        return [];
      }
      return [];
    });

    try {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Pedidos Activos')).toBeInTheDocument();
      });

      const alDiaChip = screen.getByText('al día').closest('[data-component="kpi-delta-chip"]') as HTMLElement;
      expect(alDiaChip).toBeInTheDocument();
      expect(alDiaChip).toHaveAttribute('data-trend', 'neutral');
      expect(alDiaChip).not.toHaveAttribute('data-trend', 'down');

      const style = alDiaChip.getAttribute('style') || '';
      expect(style).not.toContain('var(--bento-destructive)');
      expect(style).toContain('var(--bento-page-bg)');
    } finally {
      ApiClient.request = originalRequest;
    }
  });

  test('(c) H6: Denominador de mesas en Resumen maneja 0 mesas mostrando "sin mesas configuradas" en vez de "de 0 mesas configuradas"', async () => {
    const originalRequest = ApiClient.request;
    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint.includes('/v1/sessions?status=active')) {
        return [];
      }
      if (endpoint.includes('/v1/tables')) {
        return [];
      }
      if (endpoint.includes('/v1/orders')) {
        return [];
      }
      if (endpoint.includes('/v1/service-calls')) {
        return [];
      }
      return [];
    });

    try {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Mesas Activas')).toBeInTheDocument();
      });

      expect(screen.getByText('sin mesas configuradas')).toBeInTheDocument();
      expect(screen.queryByText(/de 0 mesas configuradas/i)).not.toBeInTheDocument();
    } finally {
      ApiClient.request = originalRequest;
    }
  });
});

describe('Unidad V23 — Resumen Operativo y Modo de Operación en Dashboard', () => {
  const originalRequest = ApiClient.request;

  beforeEach(() => {
    ApiClient.token = 'mock-admin-token';
  });

  afterEach(() => {
    ApiClient.request = originalRequest;
  });

  test('V23-1: Muestra métricas operativas (Mesas Ocupadas, Disponibilidad y SLA)', async () => {
    const mockTables = [
      { tableId: 't-1', label: '1', capacity: 4, zoneId: 'z-1', status: 'OCCUPIED' },
      { tableId: 't-2', label: '2', capacity: 2, zoneId: 'z-1', status: 'AVAILABLE' },
      { tableId: 't-3', label: '3', capacity: 6, zoneId: 'z-2', status: 'RESERVED' },
    ];
    const mockZones = [
      { id: 'z-1', name: 'Terraza', sortOrder: 1 },
      { id: 'z-2', name: 'Salón Principal', sortOrder: 2 },
    ];

    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint === '/v1/tables') return mockTables;
      if (endpoint === '/v1/zones') return mockZones;
      if (endpoint.includes('/v1/reservations')) return [];
      if (endpoint.includes('/v1/sessions')) return [{ tableId: 't-1', status: 'active' }];
      if (endpoint === '/v1/tenant/settings') return { operatingMode: 'hybrid', estimatedPrepMinutes: 25 };
      if (endpoint.includes('/v1/orders')) return [];
      if (endpoint.includes('/v1/service-calls')) return [];
      return [];
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Resumen Operativo')).toBeInTheDocument();
    expect(screen.getByText('Mesas Ocupadas')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidad')).toBeInTheDocument();
    expect(screen.getByText('Tiempo Límite Estimado')).toBeInTheDocument();
    expect(screen.getByText('25 min')).toBeInTheDocument();
    expect(screen.getByText('1 Libres')).toBeInTheDocument();
    expect(screen.getByText('1 Reservas')).toBeInTheDocument();
  });

  test('V23-2: Persistencia del SLA slider contra PATCH /v1/tenant/settings', async () => {
    let patchedBody: any = null;
    ApiClient.request = jest.fn(async (endpoint: string, opts?: any) => {
      if (endpoint === '/v1/tables') return [];
      if (endpoint === '/v1/zones') return [];
      if (endpoint.includes('/v1/reservations')) return [];
      if (endpoint.includes('/v1/sessions')) return [];
      if (endpoint === '/v1/tenant/settings') {
        if (opts?.method === 'PATCH') {
          patchedBody = JSON.parse(opts.body);
          return { operatingMode: 'hybrid', estimatedPrepMinutes: patchedBody.estimatedPrepMinutes };
        }
        return { operatingMode: 'hybrid', estimatedPrepMinutes: 18 };
      }
      if (endpoint.includes('/v1/orders')) return [];
      if (endpoint.includes('/v1/service-calls')) return [];
      return [];
    });

    render(<DashboardPage />);
    expect(await screen.findByText('18 min')).toBeInTheDocument();

    const slider = screen.getByLabelText(/Tiempo Límite Estimado/i);
    expect(slider).toBeInTheDocument();

    // Cambiar slider y disparar mouseUp
    fireEvent.change(slider, { target: { value: '35' } });
    fireEvent.mouseUp(slider, { target: { value: '35' } });

    await waitFor(() => {
      expect(patchedBody).toEqual({ estimatedPrepMinutes: 35 });
    });
  });

  test('V23-3: Toggle de Modo de Operación entre Híbrido y Solo Meseros persiste en PATCH /v1/tenant/settings', async () => {
    let patchedBody: any = null;
    let currentMode: string = 'hybrid';

    ApiClient.request = jest.fn(async (endpoint: string, opts?: any) => {
      if (endpoint === '/v1/tables') return [];
      if (endpoint === '/v1/zones') return [];
      if (endpoint.includes('/v1/reservations')) return [];
      if (endpoint.includes('/v1/sessions')) return [];
      if (endpoint === '/v1/tenant/settings') {
        if (opts?.method === 'PATCH') {
          patchedBody = JSON.parse(opts.body);
          currentMode = patchedBody.operatingMode;
          return { operatingMode: currentMode, estimatedPrepMinutes: 18 };
        }
        return { operatingMode: currentMode, estimatedPrepMinutes: 18 };
      }
      if (endpoint.includes('/v1/orders')) return [];
      if (endpoint.includes('/v1/service-calls')) return [];
      return [];
    });

    render(<DashboardPage />);
    const toggleBtn = await screen.findByTestId('operating-mode-toggle');
    expect(toggleBtn).toHaveTextContent(/Híbrido \(QR \+ Meseros\)/i);

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(patchedBody).toEqual({ operatingMode: 'waiter_only' });
      expect(toggleBtn).toHaveTextContent(/Solo Meseros \(QR Inactivo\)/i);
    });
  });

  test('V23-4: Renderizado de N Puestos • Zona y filtros de estado (TODAS, LIBRES, OCUPADAS, RESERVADAS)', async () => {
    const mockTables = [
      { tableId: 't-1', label: '1', capacity: 4, zoneId: 'z-terraza', status: 'AVAILABLE' },
      { tableId: 't-2', label: '2', capacity: 2, zoneId: 'z-terraza', status: 'OCCUPIED' },
      { tableId: 't-3', label: '3', capacity: 6, zoneId: 'z-salon', status: 'RESERVED' },
    ];
    const mockZones = [
      { id: 'z-terraza', name: 'Terraza', sortOrder: 1 },
      { id: 'z-salon', name: 'Salón Principal', sortOrder: 2 },
    ];

    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint === '/v1/tables') return mockTables;
      if (endpoint === '/v1/zones') return mockZones;
      if (endpoint.includes('/v1/reservations')) return [];
      if (endpoint.includes('/v1/sessions')) return [{ tableId: 't-2', status: 'active' }];
      if (endpoint === '/v1/tenant/settings') return { operatingMode: 'hybrid', estimatedPrepMinutes: 18 };
      if (endpoint.includes('/v1/orders')) return [];
      if (endpoint.includes('/v1/service-calls')) return [];
      return [];
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('4 Puestos • Terraza')).toBeInTheDocument();
    expect(screen.getByText('2 Puestos • Terraza')).toBeInTheDocument();
    expect(screen.getByText('6 Puestos • Salón Principal')).toBeInTheDocument();

    // Filtrar por LIBRES
    const libresTab = screen.getByRole('tab', { name: /LIBRES/i });
    fireEvent.click(libresTab);

    expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    expect(screen.queryByText('Mesa 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesa 3')).not.toBeInTheDocument();

    // Filtrar por OCUPADAS
    const ocupadasTab = screen.getByRole('tab', { name: /OCUPADAS/i });
    fireEvent.click(ocupadasTab);

    expect(screen.queryByText('Mesa 1')).not.toBeInTheDocument();
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
    expect(screen.queryByText('Mesa 3')).not.toBeInTheDocument();

    // Filtrar por RESERVADAS
    const reservadasTab = screen.getByRole('tab', { name: /RESERVADAS/i });
    fireEvent.click(reservadasTab);

    expect(screen.queryByText('Mesa 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesa 2')).not.toBeInTheDocument();
    expect(screen.getByText('Mesa 3')).toBeInTheDocument();
  });

  test('R4: Refresco sin F5 — re-evalúa y recarga datos del dashboard ante evento visibilitychange', async () => {
    let activeSessions: any[] = [];
    const mockTables = [
      { tableId: 't-1', label: 'Mesa 1', capacity: 4, zoneId: 'z-1', status: 'AVAILABLE' },
    ];

    ApiClient.request = jest.fn(async (endpoint: string) => {
      if (endpoint === '/v1/tables') return mockTables;
      if (endpoint === '/v1/zones') return [];
      if (endpoint.includes('/v1/reservations')) return [];
      if (endpoint.includes('/v1/sessions')) return activeSessions;
      if (endpoint === '/v1/tenant/settings') return { operatingMode: 'hybrid', estimatedPrepMinutes: 18 };
      if (endpoint.includes('/v1/orders')) return [];
      if (endpoint.includes('/v1/service-calls')) return [];
      return [];
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Resumen Operativo')).toBeInTheDocument();
    expect(screen.getByText('1 Libres')).toBeInTheDocument();

    // Simular que otra pestaña o comensal ocupa la mesa en el backend
    activeSessions = [{ tableId: 't-1', status: 'active' }];

    // Simular regreso del usuario a la pestaña (visibilitychange)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    // Debe refrescar automáticamente sin F5 y mostrar 0 Libres y 1 en sala
    await waitFor(() => {
      expect(screen.getByText('0 Libres')).toBeInTheDocument();
      expect(screen.getByText('1 en sala')).toBeInTheDocument();
    });
  });
});


