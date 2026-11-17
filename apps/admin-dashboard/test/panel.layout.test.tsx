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

  describe('U8: Control de acceso por rol en PanelShell', () => {
    const makeJwt = (role: string) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ userId: 'u1', tenantId: 't1', role })).toString('base64');
      return `${header}.${payload}.signature`;
    };

    test('con token MANAGER muestra todos los destinos', async () => {
      ApiClient.token = makeJwt('MANAGER');
      mockPathname = '/dashboard';

      render(
        <PanelLayout>
          <div>Dashboard Manager</div>
        </PanelLayout>,
      );

      await screen.findByText('Dashboard Manager');
      const nav = screen.getByRole('navigation', { name: /Módulos del panel/i });
      expect(nav.querySelector('a[href="/dashboard"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/menu"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/meseros"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/kds"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/checkout"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/ajustes"]')).not.toBeNull();
    });
  });
});

