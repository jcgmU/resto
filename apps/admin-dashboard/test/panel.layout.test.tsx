import React from 'react';
import fs from 'fs';
import path from 'path';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import PanelLayout, { metadata } from '../src/app/(panel)/layout';
import { ApiClient } from '../src/lib/api';

const mockReplace = jest.fn();
let mockPathname = '/kds';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => mockPathname,
}));

const appDir = path.join(__dirname, '..', 'src', 'app');

describe('U4: layout (panel) con SidebarRail + PageHeader', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = null;
    ApiClient.refreshToken = null;
    mockReplace.mockClear();
    mockPathname = '/kds';
  });

  test('con token muestra la navegación con los 7 destinos y el contenido', async () => {
    ApiClient.token = 'tok';
    render(
      <PanelLayout>
        <div>Contenido KDS</div>
      </PanelLayout>,
    );
    expect(await screen.findByText('Contenido KDS')).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    const expected: Record<string, string> = {
      Dashboard: '/dashboard',
      Menu: '/menu',
      Mesas: '/mesas',
      KDS: '/kds',
      Checkout: '/checkout',
      Pagos: '/pagos',
      Ajustes: '/ajustes',
    };
    for (const [label, href] of Object.entries(expected)) {
      const link = nav.querySelector(`a[href="${href}"]`);
      expect(link).not.toBeNull();
      expect(link).toHaveTextContent(label);
    }
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
    const active = screen.getByRole('navigation').querySelector('a[aria-current="page"]');
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
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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

  describe('U8: Control de acceso por rol en PanelShell', () => {
    const makeJwt = (role: string) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ userId: 'u1', tenantId: 't1', role })).toString('base64');
      return `${header}.${payload}.signature`;
    };

    test('con token STAFF solo muestra KDS, Mesas y Checkout en la barra lateral', async () => {
      ApiClient.token = makeJwt('STAFF');
      mockPathname = '/kds';

      render(
        <PanelLayout>
          <div>Vista KDS</div>
        </PanelLayout>,
      );

      await screen.findByText('Vista KDS');
      const nav = screen.getByRole('navigation');

      // Destinos que sí debe tener STAFF
      expect(nav.querySelector('a[href="/kds"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/mesas"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/checkout"]')).not.toBeNull();

      // Destinos restringidos ocultos para STAFF
      expect(nav.querySelector('a[href="/dashboard"]')).toBeNull();
      expect(nav.querySelector('a[href="/menu"]')).toBeNull();
      expect(nav.querySelector('a[href="/pagos"]')).toBeNull();
      expect(nav.querySelector('a[href="/ajustes"]')).toBeNull();
    });

    test('con token STAFF al intentar navegar a /dashboard muestra "Sin permiso"', async () => {
      ApiClient.token = makeJwt('STAFF');
      mockPathname = '/dashboard';

      render(
        <PanelLayout>
          <div>Dashboard Secreto</div>
        </PanelLayout>,
      );

      await screen.findByText('Sin permiso');
      expect(screen.queryByText('Dashboard Secreto')).not.toBeInTheDocument();
      expect(screen.getByText(/No tienes los permisos requeridos/i)).toBeInTheDocument();
    });

    test('con token MANAGER muestra todos los destinos', async () => {
      ApiClient.token = makeJwt('MANAGER');
      mockPathname = '/dashboard';

      render(
        <PanelLayout>
          <div>Dashboard Manager</div>
        </PanelLayout>,
      );

      await screen.findByText('Dashboard Manager');
      const nav = screen.getByRole('navigation');
      expect(nav.querySelector('a[href="/dashboard"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/menu"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/mesas"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/kds"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/checkout"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/pagos"]')).not.toBeNull();
      expect(nav.querySelector('a[href="/ajustes"]')).not.toBeNull();
    });
  });
});
