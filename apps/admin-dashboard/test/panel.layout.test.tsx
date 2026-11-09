import React from 'react';
import fs from 'fs';
import path from 'path';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PanelLayout, { metadata } from '../src/app/(panel)/layout';
import LoginPage from '../src/app/(auth)/login/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockPathname = '/kds';

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

const appDir = path.join(__dirname, '..', 'src', 'app');

describe('U4: layout (panel) con SidebarRail + PageHeader (Línea Suite)', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = null;
    ApiClient.refreshToken = null;
    mockPush.mockClear();
    mockReplace.mockClear();
    mockPathname = '/kds';
  });

  test('con token muestra la navegación con los destinos Suite (N19) y el contenido', async () => {
    ApiClient.token = 'tok';
    render(
      <PanelLayout>
        <div>Contenido KDS</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Contenido KDS')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /Módulos del panel/i });
    const expected: Record<string, string> = {
      'Resumen y Mesas': '/dashboard',
      'Monitor de Cocina': '/kds',
      'Terminal de Meseros': '/meseros',
      'Gestión del Menú': '/menu',
      'Checkout': '/checkout',
      'Ajustes': '/ajustes',
    };
    for (const [label, href] of Object.entries(expected)) {
      const link = nav.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
      expect(link).toHaveTextContent(label);
    }
    // Verifica también la presencia del rail flotante oscuro
    expect(screen.getByRole('navigation', { name: /Navegación principal/i })).toBeInTheDocument();
  });

  test('marca activo el destino de la ruta actual y usa PageHeader con su título', async () => {
    ApiClient.token = 'tok';
    mockPathname = '/checkout';
    render(
      <PanelLayout>
        <div>x</div>
      </PanelLayout>,
    );
    await screen.findByText('x');
    const active = screen.getByRole('navigation', { name: /Módulos del panel/i }).querySelector('a[aria-current="page"]');
    expect(active).toHaveAttribute('href', '/checkout');
    expect(screen.getByRole('banner')).toHaveTextContent('Checkout');
  });

  test('sin datos reales de pedidos activos no se renderiza ningún badge', async () => {
    ApiClient.token = 'tok';
    const { container } = render(
      <PanelLayout>
        <div>x</div>
      </PanelLayout>,
    );
    await screen.findByText('x');
    expect(container.querySelector('.bento-rail__badge')).toBeNull();
  });

  test('guard: sin token redirige a /login y no pinta ni el contenido ni la navegación', async () => {
    render(
      <PanelLayout>
        <div>Panel Secreto</div>
      </PanelLayout>,
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Panel Secreto')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('navigation')).toHaveLength(0);
  });

  test('renderiza los 3 puntos pastel de ventana y el modo de operación', async () => {
    ApiClient.token = 'tok';
    render(
      <PanelLayout>
        <div>Contenido</div>
      </PanelLayout>,
    );
    await screen.findByText('Contenido');
    expect(screen.getByTestId('pastel-dots')).toBeInTheDocument();
    expect(screen.getByText('Híbrido (QR + Meseros)')).toBeInTheDocument();
  });

  test('exporta metadata', () => {
    expect(metadata.title).toBeTruthy();
  });

  test('rutas: checkout y kds viven bajo (panel) y ya no en la raíz de app', () => {
    for (const r of ['checkout', 'kds']) {
      expect(fs.existsSync(path.join(appDir, '(panel)', r, 'page.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(appDir, r))).toBe(false);
    }
    for (const r of ['menu', 'mesas']) {
      expect(fs.existsSync(path.join(appDir, '(panel)', r, 'page.tsx'))).toBe(true);
    }
  });

  test('H2: contenedor de contenido consistente en PanelShell (100% para KDS, 1200px para otras)', async () => {
    ApiClient.token = 'tok';
    mockPathname = '/kds';
    const { container, rerender } = render(
      <PanelLayout>
        <div>Contenido KDS</div>
      </PanelLayout>,
    );
    await screen.findByText('Contenido KDS');
    let mainEl = container.querySelector('main');
    expect(mainEl).toHaveStyle({ maxWidth: '100%', padding: '24px' });

    mockPathname = '/dashboard';
    rerender(
      <PanelLayout>
        <div>Contenido Dashboard</div>
      </PanelLayout>,
    );
    mainEl = container.querySelector('main');
    expect(mainEl).toHaveStyle({ maxWidth: '1200px', margin: '0 auto', padding: '24px' });
  });

  test('U20: los 6 iconos del panel lateral interior tienen fill="none" y stroke="currentColor"', async () => {
    ApiClient.token = 'tok';
    render(
      <PanelLayout>
        <div>Contenido Dashboard</div>
      </PanelLayout>,
    );
    await screen.findByText('Contenido Dashboard');
    const nav = screen.getByRole('navigation', { name: /Módulos del panel/i });
    const expectedHrefs = ['/dashboard', '/kds', '/meseros', '/menu', '/checkout', '/ajustes'];

    for (const href of expectedHrefs) {
      const link = nav.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
      const svg = link?.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    }
  });

  test('U9: media query en PanelShell oculta el panel lateral interior a <=1024px para liberar el ancho principal (H5 adapt)', async () => {
    ApiClient.token = 'tok';
    const { container } = render(
      <PanelLayout>
        <div>Contenido Dashboard</div>
      </PanelLayout>,
    );
    await screen.findByText('Contenido Dashboard');
    const styleEl = container.querySelector('style');
    expect(styleEl).not.toBeNull();
    expect(styleEl?.textContent).toContain('@media (max-width: 1024px)');
    expect(styleEl?.textContent).toContain('.panel-inner-sidebar');
    expect(styleEl?.textContent).toContain('display: none !important');
    expect(container.querySelector('.panel-inner-sidebar')).toBeInTheDocument();
  });

  test('U3: botón "Cerrar sesión" en PanelShell borra resto_access_token, resto_user y resto_refresh_token de localStorage y navega a /login', async () => {
    ApiClient.token = 'tok-access';
    ApiClient.refreshToken = 'tok-refresh';
    localStorage.setItem('resto_access_token', 'tok-access');
    localStorage.setItem('resto_refresh_token', 'tok-refresh');
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-1', email: 'admin@resto.com', displayName: 'Admin Demo', role: 'ADMIN' }),
    );

    render(
      <PanelLayout>
        <div>Contenido KDS</div>
      </PanelLayout>,
    );

    await screen.findByText('Contenido KDS');
    const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).toHaveStyle({ minHeight: '44px' });

    fireEvent.click(logoutBtn);

    expect(localStorage.getItem('resto_access_token')).toBeNull();
    expect(localStorage.getItem('resto_user')).toBeNull();
    expect(localStorage.getItem('resto_refresh_token')).toBeNull();
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  test('U3: usuario con rol STAFF aterriza en /kds al iniciar sesión y al entrar a /menu en PanelShell', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        user: { id: 'u-staff', email: 'staff@resto.com', displayName: 'Cocina Staff', role: 'STAFF' },
        tokens: { accessToken: 'staff-access-tok', refreshToken: 'staff-refresh-tok' },
      }),
    })) as any;

    try {
      const { unmount } = render(<LoginPage />);
      fireEvent.change(screen.getByLabelText(/Usuario o Correo/i), { target: { value: 'staff@resto.com' } });
      fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'Staff123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/kds');
      });
      unmount();

      // Si STAFF intenta abrir /menu en PanelShell, redirige a /kds
      mockPathname = '/menu';
      render(
        <PanelLayout>
          <div>Gestión Menú Restringida</div>
        </PanelLayout>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/kds');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U7: STAFF puede abrir /checkout y /dashboard sin redirigir a /kds, y solo /menu y /ajustes redirigen a /kds', async () => {
    ApiClient.token = 'staff-tok';
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-staff', email: 'staff@resto.com', displayName: 'Cocina Staff', role: 'STAFF' }),
    );

    mockPathname = '/checkout';
    const { unmount: unmountCheckout } = render(
      <PanelLayout>
        <div>Contenido Checkout STAFF</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Contenido Checkout STAFF')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith('/kds');
    unmountCheckout();

    mockReplace.mockClear();
    mockPathname = '/dashboard';
    const { unmount: unmountDashboard } = render(
      <PanelLayout>
        <div>Contenido Dashboard STAFF</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Contenido Dashboard STAFF')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalledWith('/kds');
    unmountDashboard();

    mockReplace.mockClear();
    mockPathname = '/menu';
    const { unmount: unmountMenu } = render(
      <PanelLayout>
        <div>Contenido Menu Restringido</div>
      </PanelLayout>,
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/kds');
    });
    expect(screen.queryByText('Contenido Menu Restringido')).not.toBeInTheDocument();
    unmountMenu();

    mockReplace.mockClear();
    mockPathname = '/ajustes';
    const { unmount: unmountAjustes } = render(
      <PanelLayout>
        <div>Contenido Ajustes Restringido</div>
      </PanelLayout>,
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/kds');
    });
    expect(screen.queryByText('Contenido Ajustes Restringido')).not.toBeInTheDocument();
    unmountAjustes();
  });

  test('U7: el NAV de STAFF oculta "Gestión del Menú" y "Ajustes" en panel lateral y rail, mientras ADMIN sigue viendo los 6 ítems', async () => {
    ApiClient.token = 'staff-tok';
    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-staff', email: 'staff@resto.com', displayName: 'Cocina Staff', role: 'STAFF' }),
    );
    mockPathname = '/kds';

    const { unmount } = render(
      <PanelLayout>
        <div>Vista STAFF</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Vista STAFF')).toBeInTheDocument();

    const innerNav = screen.getByRole('navigation', { name: /Módulos del panel/i });
    const railNav = screen.getByRole('navigation', { name: /Navegación principal/i });

    expect(innerNav).toHaveTextContent('Resumen y Mesas');
    expect(innerNav).toHaveTextContent('Monitor de Cocina');
    expect(innerNav).toHaveTextContent('Terminal de Meseros');
    expect(innerNav).toHaveTextContent('Checkout');
    expect(innerNav).not.toHaveTextContent('Gestión del Menú');
    expect(innerNav).not.toHaveTextContent('Ajustes');
    expect(innerNav.querySelector('a[href="/menu"]')).toBeNull();
    expect(innerNav.querySelector('a[href="/ajustes"]')).toBeNull();
    expect(railNav.querySelector('a[href="/menu"]')).toBeNull();
    expect(railNav.querySelector('a[href="/ajustes"]')).toBeNull();
    unmount();

    localStorage.setItem(
      'resto_user',
      JSON.stringify({ id: 'u-admin', email: 'admin@resto.com', displayName: 'Admin Demo', role: 'ADMIN' }),
    );
    render(
      <PanelLayout>
        <div>Vista ADMIN</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Vista ADMIN')).toBeInTheDocument();

    const adminInnerNav = screen.getByRole('navigation', { name: /Módulos del panel/i });
    for (const label of [
      'Resumen y Mesas',
      'Monitor de Cocina',
      'Terminal de Meseros',
      'Gestión del Menú',
      'Checkout',
      'Ajustes',
    ]) {
      expect(adminInnerNav).toHaveTextContent(label);
    }
  });
});

