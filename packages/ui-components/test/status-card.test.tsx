import '@testing-library/jest-dom';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '../src';

const css = fs.readFileSync(path.resolve(__dirname, '../src/bento/bento.css'), 'utf8');
const ruleOf = (selector: string) => {
  const match = css.match(new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
};

describe('StatusCard (card con blob de estado)', () => {
  test.each([
    ['available', '--bento-status-available'],
    ['occupied', '--bento-status-occupied'],
    ['reserved', '--bento-status-reserved'],
  ] as const)('el estado %s pinta el blob con %s', (status, token) => {
    render(<StatusCard status={status}>Mesa 1</StatusCard>);
    const card = screen.getByText('Mesa 1').closest('[data-component="status-card"]') as HTMLElement;
    expect(card).toHaveAttribute('data-status', status);
    const blob = card.querySelector('[data-part="blob"]') as HTMLElement;
    expect(blob).not.toBeNull();
    expect(blob).toHaveAttribute('aria-hidden', 'true');
    expect(blob.style.getPropertyValue('--bento-blob-color')).toBe(`var(${token})`);
  });

  test('no dibuja punto ni badge de estado: solo contenido, blob y capa', () => {
    const { container } = render(<StatusCard status="occupied">Hola</StatusCard>);
    const card = container.querySelector('[data-component="status-card"]') as HTMLElement;
    expect(Array.from(card.children).map((c) => c.getAttribute('data-part'))).toEqual(['blob', 'body']);
  });

  test('variante solid no fija ancho en el blob; progress lo alarga según el valor 0-1', () => {
    const { container, rerender } = render(<StatusCard status="available">x</StatusCard>);
    const blob = () => container.querySelector('[data-part="blob"]') as HTMLElement;
    expect(blob()).toHaveAttribute('data-variant', 'solid');
    expect(blob().style.width).toBe('');

    rerender(
      <StatusCard status="available" variant="progress" progress={0.4}>
        x
      </StatusCard>
    );
    expect(blob()).toHaveAttribute('data-variant', 'progress');
    expect(blob().style.width).toBe('40%');

    rerender(
      <StatusCard status="occupied" variant="progress" progress={7}>
        x
      </StatusCard>
    );
    expect(blob().style.width).toBe('100%');
    rerender(
      <StatusCard status="occupied" variant="progress" progress={-2}>
        x
      </StatusCard>
    );
    expect(blob().style.width).toBe('0%');
  });

  test('animate={false} marca la card como sin animación', () => {
    const { container } = render(
      <StatusCard status="available" animate={false}>
        x
      </StatusCard>
    );
    expect(container.querySelector('[data-component="status-card"]')).toHaveAttribute('data-animated', 'false');
  });

  test('CSS: una sola vuelta de 4 s que termina en la esquina superior izquierda', () => {
    const blob = ruleOf('.bento-status-card__blob');
    expect(blob).toMatch(/animation:[^;]*bento-blob-orbit[^;]*4s[^;]*\b1\b[^;]*forwards/);
    const keyframes = css.match(/@keyframes bento-blob-orbit\s*\{([\s\S]*?)\n\}/);
    expect(keyframes).not.toBeNull();
    const last = keyframes![1].match(/100%\s*\{([^}]*)\}/);
    expect(last![1]).toMatch(/top:\s*0/);
    expect(last![1]).toMatch(/left:\s*0/);
  });

  test('CSS: prefers-reduced-motion desactiva la animación del blob', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.bento-status-card__blob\s*\{[^}]*animation:\s*none/
    );
  });

  test('CSS: la capa del contenido es translúcida con blur y deja ver el blob por el borde', () => {
    const body = ruleOf('.bento-status-card__body');
    expect(body).toMatch(/backdrop-filter:\s*blur\(24px\)/);
    expect(body).toMatch(/margin:\s*5px/);
  });

  test('CSS: resplandor, no línea: capa translúcida y blob grande con desenfoque', () => {
    const body = ruleOf('.bento-status-card__body');
    const alpha = body.match(/background:\s*rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)/);
    expect(alpha).not.toBeNull();
    expect(parseFloat(alpha![1])).toBeLessThanOrEqual(0.85);

    const blob = ruleOf('.bento-status-card__blob');
    expect(parseInt(blob.match(/width:\s*(\d+)px/)![1], 10)).toBeGreaterThanOrEqual(150);
    expect(parseInt(blob.match(/blur\((\d+)px\)/)![1], 10)).toBeGreaterThanOrEqual(12);
    expect(blob).toMatch(/translate\(-50%,\s*-50%\)/);
  });

  test('CSS: en progreso el resplandor es grueso y suave sobre el borde superior', () => {
    const progress = ruleOf('.bento-status-card__blob[data-variant="progress"]');
    expect(parseInt(progress.match(/height:\s*(\d+)px/)![1], 10)).toBeGreaterThanOrEqual(32);
    expect(parseInt(progress.match(/blur\((\d+)px\)/)![1], 10)).toBeGreaterThanOrEqual(12);
  });

  test('CSS: el progreso cero no tiene ancho mínimo y movimiento reducido desactiva la transición', () => {
    const progress = ruleOf('.bento-status-card__blob[data-variant="progress"]');
    expect(progress).not.toMatch(/min-width:\s*[1-9]/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.bento-status-card__blob\s*\{[^}]*transition:\s*none/);
  });
});
