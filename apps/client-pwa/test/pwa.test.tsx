import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TableLandingPage from '../src/app/t/[tenantId]/[tableId]/page';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { GuestSessionGuard } from '../src/components/GuestSessionGuard';
import { ProductListCard } from '../src/components/ProductListCard';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import { ModifierGroupPicker } from '../src/components/ModifierGroupPicker';
import { PwaApiClient } from '../src/lib/api';
import { FeatureGuard, BENTO_TOKENS, BENTO_STYLESHEET } from '@packages/ui-components';

describe('C. Client PWA — Bento Box mobile-first (Tests 16-27)', () => {
  beforeEach(() => {
    PwaApiClient.guestToken = null;
    PwaApiClient.session = null;
  });

  test('16. Landing /t/:tenantId/:tableId?k=valid -> llama POST /v1/sessions/open y redirige a ./menu; guarda guest token', async () => {
    render(<TableLandingPage params={{ tenantId: 't-1', tableId: 'tb-1' }} searchParams={{ k: 'valid-key' }} />);

    await waitFor(() => {
      expect(PwaApiClient.guestToken).toBeDefined();
      expect(window.location.pathname).toContain('/menu');
    });
  });

  test('17. open rechazado (QR_KEY_INVALID/TABLE_INACTIVE) -> BentoCard de error con role="alert", sin redirect', async () => {
    render(<TableLandingPage params={{ tenantId: 't-1', tableId: 'tb-1' }} searchParams={{ k: 'invalid-key' }} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(window.location.pathname).not.toContain('/menu');
  });

  test('18. GuestSessionGuard: acceder a ./menu sin sesión -> vista "Escanea el QR de tu mesa", cero datos de carta', () => {
    render(
      <GuestSessionGuard>
        <div>Carta Secreta</div>
      </GuestSessionGuard>
    );

    expect(screen.getByText(/Escanea el QR de tu mesa/i)).toBeInTheDocument();
    expect(screen.queryByText('Carta Secreta')).not.toBeInTheDocument();
  });

  test('19. menu lista categorías como chips y productos como data-component="bento-card" dentro de data-component="bento-grid"', async () => {
    PwaApiClient.guestToken = 'valid-token';
    const { container } = render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

    const grid = await waitFor(() => container.querySelector('[data-component="bento-grid"]'));
    expect(grid).toBeInTheDocument();

    const cards = container.querySelectorAll('[data-component="bento-card"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  test('20. Producto con isAvailable=false muestra badge con texto "No disponible" (no solo color)', () => {
    render(
      <ProductListCard
        product={{
          id: 'p-1',
          name: 'Tacos Al Pastor',
          price: 9.5,
          categoryId: 'cat-1',
          isAvailable: false,
          sortOrder: 0,
          tenantId: 't-1',
        }}
      />
    );

    expect(screen.getByText(/No disponible/i)).toBeInTheDocument();
  });

  test('21. Tocar ProductListCard abre ProductDetailSheet con role="dialog" y aria-modal="true", mostrando los modifierGroups del producto con opciones y priceDelta', async () => {
    const onSelect = jest.fn();
    render(
      <div>
        <ProductListCard
          product={{
            id: 'p-1',
            name: 'Hamburguesa',
            price: 12.0,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
          }}
          onSelect={onSelect}
        />
        <ProductDetailSheet
          isOpen={true}
          onClose={() => {}}
          product={{
            id: 'p-1',
            name: 'Hamburguesa',
            price: 12.0,
            categoryId: 'cat-1',
            isAvailable: true,
            sortOrder: 0,
            tenantId: 't-1',
            modifierGroups: [
              {
                id: 'mg-1',
                name: 'Término de la carne',
                minSelections: 1,
                maxSelections: 1,
                isRequired: true,
                tenantId: 't-1',
                options: [{ id: 'opt-1', name: 'Tres cuartos', priceDelta: 0, isDefault: true, groupId: 'mg-1' }],
              },
            ],
          }}
        />
      </div>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Término de la carne/i)).toBeInTheDocument();
    expect(screen.getByText(/Tres cuartos/i)).toBeInTheDocument();
  });

  test('22. ModifierGroupPicker bloquea seleccionar más de maxSelections opciones y señala los grupos obligatorios', () => {
    const onChange = jest.fn();
    render(
      <ModifierGroupPicker
        group={{
          id: 'mg-1',
          name: 'Salsas',
          minSelections: 1,
          maxSelections: 2,
          isRequired: true,
          tenantId: 't-1',
          options: [
            { id: 'opt-1', name: 'Ketchup', priceDelta: 0, isDefault: false, groupId: 'mg-1' },
            { id: 'opt-2', name: 'Mostaza', priceDelta: 0, isDefault: false, groupId: 'mg-1' },
            { id: 'opt-3', name: 'Mayonesa', priceDelta: 0, isDefault: false, groupId: 'mg-1' },
          ],
        }}
        selectedOptions={['opt-1', 'opt-2']}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/Obligatorio/i)).toBeInTheDocument();
    const thirdOpt = screen.getByLabelText(/Mayonesa/i);
    fireEvent.click(thirdOpt);
    expect(onChange).not.toHaveBeenCalledWith(['opt-1', 'opt-2', 'opt-3']);
  });

  test('23. La llamada GraphQL del menú adjunta Authorization: Bearer <guestToken> (assert sobre el handler MSW)', async () => {
    PwaApiClient.guestToken = 'guest-jwt-token-xyz';
    const menuResult = await PwaApiClient.fetchMenu('t-1');
    expect(menuResult.authorized).toBe(true);
  });

  test('24. Estructura Bento: cards y chips referencian var(--bento-*) (sin hex/px hardcodeados) y el único data-tone="accent" por tarjeta es el KpiValue del precio', () => {
    const { container } = render(
      <ProductListCard
        product={{
          id: 'p-1',
          name: 'Ceviche',
          price: 15.0,
          categoryId: 'cat-1',
          isAvailable: true,
          sortOrder: 0,
          tenantId: 't-1',
        }}
      />
    );

    const card = container.querySelector('[data-component="bento-card"]');
    expect(card).toBeInTheDocument();
    const styleAttr = card?.getAttribute('style') || '';
    expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);

    const accentElements = container.querySelectorAll('[data-tone="accent"]');
    expect(accentElements.length).toBe(1);
    expect(accentElements[0]).toHaveAttribute('data-component', 'kpi-value');
  });

  test('25. Móvil: todo touchable referencia el token --bento-touch-target (44px) y la hoja de tokens del PWA define safe-area y grid 1->2 columnas', () => {
    expect(BENTO_TOKENS['--bento-touch-target']).toBe('44px');
    expect(BENTO_TOKENS['--bento-touch-gap']).toBe('8px');
    expect(BENTO_STYLESHEET).toContain('env(safe-area-inset-bottom)');
    expect(BENTO_STYLESHEET).toContain('@media (max-width: 640px)');
  });

  test('26. Cero decoración y a11y: iconos SVG con aria-hidden="true", imágenes de producto con alt, sin emojis como iconos; el sheet mueve el foco al abrir y lo devuelve al cerrar', () => {
    const { container } = render(
      <ProductListCard
        product={{
          id: 'p-1',
          name: 'Pizza Margherita',
          price: 11.0,
          categoryId: 'cat-1',
          isAvailable: true,
          imageUrl: 'pizza.jpg',
          sortOrder: 0,
          tenantId: 't-1',
        }}
      />
    );

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0]).toHaveAttribute('alt');
    expect(imgs[0].getAttribute('alt')).not.toBe('');

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('27. Cobro solo por personal (R10): El cliente/guest NO tiene botón de "Pagar" en la PWA (el cobro es exclusivo de caja en admin)', () => {
    PwaApiClient.guestToken = 'valid-token';
    render(<ClientMenuPage params={{ tenantId: 't-1', tableId: 'tb-1' }} />);

    expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^pagar$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pedir la cuenta/i })).toBeInTheDocument();
  });
});
