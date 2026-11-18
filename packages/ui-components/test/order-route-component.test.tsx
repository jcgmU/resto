import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { OrderRoute } from '../src/kit/OrderRoute';

const events = [
  { id: '1', fromStatus: 'PLACED', toStatus: 'IN_KITCHEN', occurredAt: '2026-10-14T12:05:00Z' },
  { id: '2', fromStatus: 'IN_KITCHEN', toStatus: 'READY', occurredAt: '2026-10-14T12:20:00Z' },
];

describe('OrderRoute', () => {
  test('lista ordenada con los 4 pasos, flechas decorativas y aria-current en el actual', () => {
    render(<OrderRoute status="IN_KITCHEN" />);
    const list = screen.getByRole('list', { name: /ruta del plato/i });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).toHaveAttribute('data-state', 'current');
    expect(items[0]).toHaveAttribute('data-state', 'done');
    expect(items[2]).toHaveAttribute('data-state', 'pending');
    const arrows = list.querySelectorAll('[data-component="route-arrow"]');
    expect(arrows).toHaveLength(3);
    arrows.forEach((a) => expect(a).toHaveAttribute('aria-hidden', 'true'));
  });

  test('modo compacto: etiqueta visible solo del paso actual; el resto accesible para lectores', () => {
    render(<OrderRoute status="READY" />);
    expect(screen.getByText('Listo')).toBeVisible();
    expect(screen.getByText('Recibido').getAttribute('data-sr-only')).toBe('true');
    expect(screen.getByText('Listo').getAttribute('data-sr-only')).toBeNull();
    expect(document.querySelector('[data-component="route-time"]')).toBeNull();
  });

  test('modo detalle: etiquetas, hora HH:mm y +N min entre pasos', () => {
    render(<OrderRoute status="READY" events={events} createdAt="2026-10-14T12:00:00Z" mode="detail" />);
    expect(screen.getByText('Recibido').getAttribute('data-sr-only')).toBeNull();
    const times = Array.from(document.querySelectorAll('[data-component="route-time"]')).map((n) => n.textContent ?? '');
    expect(times).toHaveLength(3);
    times.forEach((t) => expect(t).toMatch(/\d{1,2}:\d{2}/));
    expect(screen.getByText('+5 min')).toBeInTheDocument();
    expect(screen.getByText('+15 min')).toBeInTheDocument();
  });

  test('cancelado: paso cortado con estado destructivo y sin aria-current', () => {
    render(<OrderRoute status="CANCELLED" events={[{ id: '1', fromStatus: 'PLACED', toStatus: 'CANCELLED', occurredAt: '2026-10-14T12:01:00Z' }]} mode="detail" />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-state', 'cancelled');
    expect(items[0].getAttribute('aria-current')).toBeNull();
    expect(screen.getByText(/cancelado/i)).toBeInTheDocument();
  });

  test('la flecha del tramo activo se anima y el movimiento reducido la detiene', () => {
    render(<OrderRoute status="IN_KITCHEN" />);
    const arrows = document.querySelectorAll('[data-component="route-arrow"]');
    expect(arrows[1]).toHaveAttribute('data-active', 'true');
    expect(arrows[0]).not.toHaveAttribute('data-active');
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/@keyframes\s+\S+/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[^}]*\{[^}]*animation:\s*none/);
  });

  test('usa solo tokens bento (sin colores sueltos)', () => {
    const { container } = render(<OrderRoute status="IN_KITCHEN" mode="detail" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test('compacto: pendientes con borde visible y fondo transparente; flechas entre todos los pasos', () => {
    render(<OrderRoute status="PLACED" />);
    const dots = document.querySelectorAll<HTMLElement>('[data-component="route-dot"]');
    expect(dots).toHaveLength(4);
    expect(dots[3].style.getPropertyValue('--route-dot-border')).toBe('var(--bento-text-muted)');
    expect(dots[3].style.background).toBe('transparent');
    const arrows = document.querySelectorAll('[data-component="route-arrow"]');
    expect(arrows).toHaveLength(3);
    arrows.forEach((a) => expect(a.getAttribute('stroke')).not.toBe('var(--bento-border)'));
  });

  test('compacto: sin min-width, con flex-shrink activo, ol sin desborde y etiqueta solo en el actual', () => {
    render(<OrderRoute status="IN_KITCHEN" />);
    const list = screen.getByRole('list', { name: /ruta del plato/i });
    expect(parseFloat(list.style.minWidth)).toBe(0);
    expect(list.style.overflow).toBe('visible');
    const items = screen.getAllByRole('listitem');
    items.forEach((li) => {
      expect(li.style.minWidth).toBe('');
      expect(li.style.flexShrink).toBe('1');
    });
    document.querySelectorAll<HTMLElement>('[data-component="route-arrow"]').forEach((a) => {
      expect(a.style.flexShrink).toBe('1');
      expect(parseFloat(a.style.minWidth)).toBe(0);
    });
    const visibleLabels = Array.from(list.querySelectorAll('[data-label]')).filter((n) => n.getAttribute('data-sr-only') !== 'true');
    expect(visibleLabels).toHaveLength(1);
    expect(visibleLabels[0]).toHaveTextContent('En cocina');
    expect((visibleLabels[0] as HTMLElement).style.position).toBe('absolute');
  });

  test('compacto: los anchos fijos (puntos + flechas mínimas) caben en 150 px', () => {
    render(<OrderRoute status="READY" />);
    const dots = Array.from(document.querySelectorAll<HTMLElement>('[data-component="route-dot"]'));
    const arrows = Array.from(document.querySelectorAll<HTMLElement>('[data-component="route-arrow"]'));
    const fixed = dots.reduce((sum, d) => sum + parseFloat(d.style.width), 0) + arrows.reduce((sum, a) => sum + parseFloat(a.style.minWidth || '0'), 0);
    expect(fixed).toBeLessThanOrEqual(150);
    expect(Math.max(...dots.map((d) => parseFloat(d.style.width)))).toBeLessThanOrEqual(12);
  });

  test('detalle: lista vertical con filas en cuadrícula, hora y duración a la derecha y línea que une los puntos', () => {
    render(<OrderRoute status="READY" events={events} createdAt="2026-10-14T12:00:00Z" mode="detail" />);
    const list = screen.getByRole('list', { name: /ruta del plato/i });
    expect(list.style.flexDirection).toBe('column');
    const items = screen.getAllByRole('listitem');
    items.forEach((li) => expect(li.style.display).toBe('grid'));
    expect(document.querySelectorAll('[data-component="route-arrow"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-component="route-line"]')).toHaveLength(3);
    const row = items[2];
    expect(row.querySelector('[data-component="route-time"]')).not.toBeNull();
    expect(row.querySelector('[data-component="route-duration"]')).toHaveTextContent('+15 min');
    expect((row.querySelector('[data-component="route-duration"]') as HTMLElement).style.whiteSpace).toBe('nowrap');
  });

  test('detalle: duraciones largas legibles', () => {
    render(
      <OrderRoute
        status="IN_KITCHEN"
        events={[{ fromStatus: 'PLACED', toStatus: 'IN_KITCHEN', occurredAt: '2026-10-14T22:26:00Z' }]}
        createdAt="2026-10-14T12:00:00Z"
        mode="detail"
      />,
    );
    expect(screen.getByText('+10 h 26 min')).toBeInTheDocument();
  });
});
