import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { CartFab } from '../src/components/cart/CartFab';
import { PwaApiClient } from '../src/lib/api';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';
import fs from 'fs';
import path from 'path';

describe('U23 / H6: PWA a 375px — Layout, catálogo 100% y footer fijo con safe-area y CartFab', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'token-guest-real';
    PwaApiClient.session = { sessionId: 'sess-real', tableId: 'tb-real', tenantId: 'tenant-real' };

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-bebidas', name: 'Bebidas' },
                { id: 'cat-fondos', name: 'Platos de fondo' },
              ],
              products: [
                { id: 'prod-1', name: 'Limonada Natural', price: 25, categoryId: 'cat-bebidas', isAvailable: true },
                { id: 'prod-2', name: 'Lomo Saltado', price: 45, categoryId: 'cat-fondos', isAvailable: true },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    PwaApiClient.guestToken = null;
    PwaApiClient.session = null;
  });

  test('H6 (a): El layout no contiene elementos con anchos fijos restrictivos y ocupa el 100% a ancho móvil', async () => {
    const { container } = render(
      <FeatureFlagProviderRoot provider={new StaticFeatureFlagProvider({ payments: true })}>
        <ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />
      </FeatureFlagProviderRoot>
    );

    await waitFor(() => {
      expect(screen.getByText('Limonada Natural')).toBeInTheDocument();
    });

    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveStyle({
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    });

    // Header principal con h1 Carta (D9.2)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Carta' });
    expect(h1).toBeInTheDocument();

    // Header de categorías (TabsPill)
    const header = container.querySelector('header[data-component="category-tabs"]') || container.querySelectorAll('header')[1];
    expect(header).toBeInTheDocument();
    expect(header).toHaveStyle({
      width: '100%',
      maxWidth: '100%',
      overflowX: 'auto',
      boxSizing: 'border-box',
    });

    // Sección de catálogo
    const catalogSection = screen.getByRole('region', { name: 'Catálogo' });
    expect(catalogSection).toBeInTheDocument();
    expect(catalogSection).toHaveStyle({
      width: '100%',
      boxSizing: 'border-box',
    });

    // BentoGrid del catálogo
    const bentoGrid = catalogSection.querySelector('[data-component="bento-grid"]');
    expect(bentoGrid).toBeInTheDocument();
    expect(bentoGrid).toHaveStyle({
      width: '100%',
      boxSizing: 'border-box',
    });

    // Regla de bento.css a <= 640px fuerza 1 columna al 100%
    const bentoCss = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/ui-components/src/bento/bento.css'),
      'utf-8'
    );
    expect(bentoCss).toContain('grid-template-columns: 1fr !important;');
  });

  test('H6 (b): El footer fijo se posiciona dentro del viewport con safe-area y zIndex 30 conviviendo con CartFab (zIndex 40)', async () => {
    const { container } = render(
      <FeatureFlagProviderRoot provider={new StaticFeatureFlagProvider({ payments: true })}>
        <ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />
      </FeatureFlagProviderRoot>
    );

    await waitFor(() => {
      expect(screen.getByText('Limonada Natural')).toBeInTheDocument();
    });

    const footer = container.querySelector('footer');
    expect(footer).toBeInTheDocument();
    expect(footer?.style.position).toBe('fixed');
    expect(footer?.style.bottom).toBe('0px');
    expect(footer?.style.left).toBe('0px');
    expect(footer?.style.right).toBe('0px');
    expect(footer?.style.width).toBe('100%');
    expect(footer?.style.zIndex).toBe('30');
    expect(footer?.style.boxSizing).toBe('border-box');
    expect(footer?.style.backgroundColor).toBe('var(--bento-page-bg-pwa)');
    expect(footer?.style.display).toBe('flex');
    expect(footer?.style.flexDirection).toBe('column');
    expect(footer?.style.gap).toBe('8px');

    // Safe area y estilos con CSS variables en footer y main en el código fuente (jsdom no parsea la función CSS env() ni shorthands con var())
    const menuSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/t/[tenantId]/[tableId]/menu/page.tsx'),
      'utf-8'
    );
    expect(menuSource).toContain("borderTop: '1px solid var(--bento-border)'");
    expect(menuSource).toContain("padding: '12px 16px'");
    expect(menuSource).toContain("paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))'");
    expect(menuSource).toContain("paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))'");

    // Botones de footer tienen width 100% y minHeight touch-target
    const btnPedirCuenta = screen.getByRole('button', { name: /Pedir la cuenta/i });
    expect(btnPedirCuenta).toHaveStyle({
      width: '100%',
      boxSizing: 'border-box',
    });

    expect(screen.queryByRole('button', { name: /Pagar/i })).not.toBeInTheDocument();

    // CartFab convive en fixed a bottom: 140px con zIndex: 40 por encima del footer (30)
    const { container: fabContainer } = render(<CartFab itemCount={1} />);
    const fabBtn = fabContainer.querySelector('[data-component="cart-fab"]');
    expect(fabBtn).toHaveStyle({
      position: 'fixed',
      bottom: '140px',
      right: '16px',
      zIndex: 40,
    });
  });
});
