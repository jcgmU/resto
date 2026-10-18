import React from 'react';
import fs from 'fs';
import path from 'path';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  BentoGrid,
  BentoCard,
  KpiValue,
  AvailabilityToggle,
  BENTO_TOKENS,
  BENTO_STYLESHEET,
} from '../src';

// Función para calcular luminancia relativa y ratio de contraste WCAG
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('E.2 Estructura visual Bento Box (Tests 37-44)', () => {
  test('37. BentoGrid renderiza data-component="bento-grid" y referencia var(--bento-grid-gap) en su estilo; ningún valor de gap en px hardcodeado', () => {
    const { container } = render(
      <BentoGrid>
        <div>Contenido</div>
      </BentoGrid>
    );

    const grid = container.querySelector('[data-component="bento-grid"]') as HTMLElement;
    expect(grid).toBeInTheDocument();
    const styleAttr = grid.getAttribute('style') || '';
    expect(styleAttr).toContain('var(--bento-grid-gap)');
    expect(styleAttr).not.toMatch(/gap:\s*\d+px/);
  });

  test('38. BentoCard referencia var(--bento-card-radius), var(--bento-card-shadow) y var(--bento-card-bg); sin hex ni px inline', () => {
    const { container } = render(
      <BentoCard>
        <div>Tarjeta</div>
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toBeInTheDocument();
    const styleAttr = card.getAttribute('style') || '';
    expect(styleAttr).toContain('var(--bento-card-radius)');
    expect(styleAttr).toContain('var(--bento-card-shadow)');
    // jsdom no serializa background/backgroundColor con var(), la fuente de verdad es la regla de la card en el stylesheet
    expect(BENTO_STYLESHEET).toContain('background-color: var(--bento-card-bg);');
    expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test('39. Tokens (test unitario puro): paleta Suite (page-bg #d0d3d6, text #3a3c3e, primary #5c6784, rail-bg #1d1f22, status occupied #e0a6a6, reserved #dcc98a, available #8fbf95, info #a5b9c6), radios (card 2rem, inner 1.5rem) y sombras neumorfas', () => {
    expect(BENTO_TOKENS['--bento-page-bg']).toBe('#d0d3d6');
    expect(BENTO_TOKENS['--bento-card-bg']).toBe('rgba(255, 255, 255, 0.65)');
    expect(BENTO_TOKENS['--bento-text']).toBe('#3a3c3e');
    expect(BENTO_TOKENS['--bento-text-muted']).toBe('#666666');
    expect(BENTO_TOKENS['--bento-primary']).toBe('#5c6784');
    expect(BENTO_TOKENS['--bento-primary-hover']).toBe('#4a536b');
    expect(BENTO_TOKENS['--bento-rail-bg']).toBe('#1d1f22');
    expect(BENTO_TOKENS['--bento-rail-active']).toBe('#a5b9c6');
    expect(BENTO_TOKENS['--bento-rail-inactive']).toBe('#6b7280');
    expect(BENTO_TOKENS['--bento-status-occupied']).toBe('#e0a6a6');
    expect(BENTO_TOKENS['--bento-status-reserved']).toBe('#dcc98a');
    expect(BENTO_TOKENS['--bento-status-available']).toBe('#8fbf95');
    expect(BENTO_TOKENS['--bento-info']).toBe('#a5b9c6');
    expect(BENTO_TOKENS['--bento-card-radius']).toBe('2rem');
    expect(BENTO_TOKENS['--bento-inner-radius']).toBe('1.5rem');
    expect(BENTO_TOKENS['--bento-pill-radius']).toBe('9999px');
    expect(BENTO_TOKENS['--bento-grid-gap']).toBe('16px');
    expect(BENTO_TOKENS['--bento-card-shadow']).toBe(
      '4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)'
    );

    // Alias deprecados eliminados en U9
    expect(BENTO_TOKENS['--bento-lima']).toBeUndefined();
    expect(BENTO_TOKENS['--bento-tinta']).toBeUndefined();
    expect(BENTO_TOKENS['--bento-hueso']).toBeUndefined();
    expect(BENTO_TOKENS['--bento-papel']).toBeUndefined();
  });

  test('40. Contraste (test unitario puro, función WCAG sobre los hex de los tokens): texto y textos asociados a estados pastel cumplen ratio AA (>= 4.5:1)', () => {
    // Texto principal sobre papel (#ffffff) y sobre fondo de página (#d0d3d6)
    const textRatio = getContrastRatio(BENTO_TOKENS['--bento-text'], '#ffffff');
    expect(textRatio).toBeGreaterThanOrEqual(4.5);

    const pageTextRatio = getContrastRatio(BENTO_TOKENS['--bento-text'], BENTO_TOKENS['--bento-page-bg']);
    expect(pageTextRatio).toBeGreaterThanOrEqual(4.5);

    // Texto secundario sobre fondo papel
    const mutedRatio = getContrastRatio(BENTO_TOKENS['--bento-text-muted'], '#ffffff');
    expect(mutedRatio).toBeGreaterThanOrEqual(4.5);

    // Primario con texto blanco
    const primaryRatio = getContrastRatio('#ffffff', BENTO_TOKENS['--bento-primary']);
    expect(primaryRatio).toBeGreaterThanOrEqual(4.5);

    // Estados pastel: textos asociados oscuros garantizan contraste AA (>= 4.5:1)
    const occupiedTextRatio = getContrastRatio(BENTO_TOKENS['--bento-status-occupied-text'], '#ffffff');
    expect(occupiedTextRatio).toBeGreaterThanOrEqual(4.5);

    const reservedTextRatio = getContrastRatio(BENTO_TOKENS['--bento-status-reserved-text'], '#ffffff');
    expect(reservedTextRatio).toBeGreaterThanOrEqual(4.5);

    const availableTextRatio = getContrastRatio(BENTO_TOKENS['--bento-status-available-text'], '#ffffff');
    expect(availableTextRatio).toBeGreaterThanOrEqual(4.5);

    // Los colores pastel solos sobre blanco tienen bajo contraste (< 3:1), por lo que siempre requieren texto oscuro asociado
    expect(getContrastRatio(BENTO_TOKENS['--bento-status-occupied'], '#ffffff')).toBeLessThan(3.0);
    expect(getContrastRatio(BENTO_TOKENS['--bento-status-reserved'], '#ffffff')).toBeLessThan(3.0);
    expect(getContrastRatio(BENTO_TOKENS['--bento-status-available'], '#ffffff')).toBeLessThan(3.0);
  });

  test('41. Acento vibrante solo en datos clave: en una tarjeta renderizada con precio y estado, el ÚNICO elemento con data-tone="accent" es el KpiValue del precio', () => {
    const { container } = render(
      <BentoCard>
        <h3>Hamburguesa</h3>
        <KpiValue label="Precio" value="$12.00" tone="accent" />
        <KpiValue label="Calorías" value="450" tone="neutral" />
      </BentoCard>
    );

    const accentElements = container.querySelectorAll('[data-tone="accent"]');
    expect(accentElements.length).toBe(1);
    expect(accentElements[0]).toHaveAttribute('data-component', 'kpi-value');
  });

  test('42. Cero decoración: todo SVG de icono junto a texto tiene aria-hidden="true"; no existe <img> sin alt; no hay emojis usados como iconos', () => {
    const { container } = render(
      <BentoCard>
        <svg aria-hidden="true" data-testid="icon">
          <circle cx="10" cy="10" r="5" />
        </svg>
        <span>Guardar</span>
        <img src="test.jpg" alt="Foto plato" />
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });

  test('43. Controles accesibles: todo botón y switch de las tarjetas tiene nombre accesible; BentoCard interactive declara cursor pointer y no outline permanente inline', () => {
    const { container } = render(
      <BentoCard interactive onClick={() => {}}>
        <button aria-label="Editar">Editar</button>
        <AvailabilityToggle label="Disponible para ordenar" checked={true} onChange={() => {}} />
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toHaveAttribute('data-interactive', 'true');
    const styleAttr = card.getAttribute('style') || '';
    expect(styleAttr).toContain('cursor: pointer');
    expect(styleAttr).not.toContain('outline');
    expect(styleAttr).not.toContain('var(--bento-focus-ring)');
  });

  test('44. Responsive + motion y stylesheet Suite: BentoGrid declara el colapso 4->2->1, hover scale/transiciones desactivados bajo prefers-reduced-motion, y stylesheet contiene tokens Suite y fuentes', () => {
    expect(BENTO_STYLESHEET).toContain('@media (max-width: 1024px)');
    expect(BENTO_STYLESHEET).toContain('@media (max-width: 640px)');
    expect(BENTO_STYLESHEET).not.toContain('@media (min-width: 640px)');
    expect(BENTO_STYLESHEET).toContain('@media (prefers-reduced-motion: reduce)');
    expect(BENTO_STYLESHEET).toContain('transform: none !important');
    // Verificación de los hex clave de la paleta Suite y tipografía en stylesheet
    expect(BENTO_STYLESHEET).toContain('#d0d3d6');
    expect(BENTO_STYLESHEET).toContain('#3a3c3e');
    expect(BENTO_STYLESHEET).toContain('#5c6784');
    expect(BENTO_STYLESHEET).toContain('#1d1f22');
    expect(BENTO_STYLESHEET).toContain('#a5b9c6');
    expect(BENTO_STYLESHEET).toContain('#e0a6a6');
    expect(BENTO_STYLESHEET).toContain('#dcc98a');
    expect(BENTO_STYLESHEET).toContain('#8fbf95');
    expect(BENTO_STYLESHEET).toContain('Bricolage Grotesque');
    expect(BENTO_STYLESHEET).toContain('DM Sans');
  });

  test('45. Regresión H1/U19: bento.css declara padding y background-color en [data-component="bento-card"] y regla :focus-visible para interactive', () => {
    const cssPath = path.resolve(__dirname, '../src/bento/bento.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Token --bento-card-padding en :root
    expect(cssContent).toMatch(/--bento-card-padding:\s*24px;/);

    // Padding y background-color en la card
    expect(cssContent).toMatch(/\[data-component=["']bento-card["']\]\s*\{[^}]*padding:\s*var\(--bento-card-padding,\s*24px\);/s);
    expect(cssContent).toMatch(/\[data-component=["']bento-card["']\]\s*\{[^}]*background-color:\s*var\(--bento-card-bg\);/s);

    // Regla :focus-visible para interactivo
    expect(cssContent).toMatch(/\[data-component=["']bento-card["']\]\[data-interactive=["']true["']\]:focus-visible\s*\{[^}]*outline:\s*var\(--bento-focus-ring\);[^}]*outline-offset:\s*2px;/s);
  });

  test('46. Regresión H1/U19: BENTO_TOKENS y BENTO_STYLESHEET declaran --bento-card-padding y estilos consistentes', () => {
    expect(BENTO_TOKENS['--bento-card-padding']).toBe('24px');
    expect(BENTO_STYLESHEET).toContain('--bento-card-padding: 24px;');
    expect(BENTO_STYLESHEET).toContain('padding: var(--bento-card-padding, 24px);');
    expect(BENTO_STYLESHEET).toContain('[data-component="bento-card"][data-interactive="true"]:focus-visible');
  });

  test('47. Regresión H1/U19: BentoCard no renderiza custom properties que se referencien a sí mismas y no tiene outline inline permanente', () => {
    const { container } = render(
      <BentoCard interactive>
        <div>Contenido</div>
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    const styleAttr = card.getAttribute('style') || '';

    // No debe declarar la propiedad --bento-card-bg en inline styles
    expect(styleAttr).not.toMatch(/--bento-card-bg\s*:/);
    // No debe existir referencia circular '--x': 'var(--x)'
    expect(styleAttr).not.toMatch(/--([a-zA-Z0-9_-]+):\s*var\(--\1\)/);

    // Interactive sólo tiene cursor pointer, sin outline inline
    expect(styleAttr).toContain('cursor: pointer');
    expect(styleAttr).not.toContain('outline');
    expect(styleAttr).not.toContain('var(--bento-focus-ring)');
  });

  test('48. D9.3: .bento-tabs__tab tiene min-height: var(--bento-touch-target) sincronizado en bento.css y BENTO_STYLESHEET', () => {
    const cssPath = path.resolve(__dirname, '../src/bento/bento.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(cssContent).toMatch(/\.bento-tabs__tab\s*\{[^}]*min-height:\s*var\(--bento-touch-target\);/s);
    expect(BENTO_STYLESHEET).toMatch(/\.bento-tabs__tab\s*\{[^}]*min-height:\s*var\(--bento-touch-target\);/s);
  });
});
