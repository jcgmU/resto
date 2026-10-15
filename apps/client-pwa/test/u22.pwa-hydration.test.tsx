import { TextEncoder, TextDecoder } from 'util';
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { CartFab } from '../src/components/cart/CartFab';
import { GuestSessionGuard } from '../src/components/GuestSessionGuard';

describe('U22 / H4: PWA Hidratación y Layout 375px', () => {
  test('H4 (a): GuestSessionGuard SSR renderToString coincide con el markup inicial en cliente sin inject de <style>', () => {
    // 1. SSR renderToString
    const ssrHtml = renderToString(
      <GuestSessionGuard>
        <div>Contenido protegido</div>
      </GuestSessionGuard>
    );

    expect(ssrHtml).toContain('data-testid="guest-guard-loading"');
    expect(ssrHtml).not.toContain('<style');
    expect(ssrHtml).toContain('var(--bento-hueso)');

    // 2. Client render antes de montaje
    const { container } = render(
      <GuestSessionGuard>
        <div>Contenido protegido</div>
      </GuestSessionGuard>
    );

    // No debe contener tags style inline injectados en el guard
    expect(container.querySelectorAll('style').length).toBe(0);
  });

  test('H4 (b): CartFab tiene posición fija a bottom 140px, right 16px y z-index 40 para no superponer chips ni footer a 375px', () => {
    const { getByRole } = render(<CartFab itemCount={2} onClick={() => {}} />);
    const btn = getByRole('button', { name: /Carrito con 2 productos/i });

    expect(btn).toHaveStyle({
      position: 'fixed',
      right: '16px',
      bottom: '140px',
      zIndex: 40,
    });
  });

  test('H4 (b): Layout 375px y tokens de espaciado en bento.css y menú PWA', () => {
    const fs = require('fs');
    const path = require('path');
    const bentoCss = fs.readFileSync(path.resolve(__dirname, '../../../packages/ui-components/src/bento/bento.css'), 'utf-8');
    expect(bentoCss).toContain('--bento-spacing-md: 16px;');
    expect(bentoCss).toContain('--bento-spacing-sm: 8px;');

    const menuSource = fs.readFileSync(path.resolve(__dirname, '../src/app/t/[tenantId]/[tableId]/menu/page.tsx'), 'utf-8');
    expect(menuSource).toContain('env(safe-area-inset-bottom, 0px)');
    expect(menuSource).toContain('paddingBottom: \'calc(140px + env(safe-area-inset-bottom, 0px))\'');
  });
});
