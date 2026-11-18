import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fetchZones, updateZone } from '../src/lib/api/tables';

jest.mock('../src/lib/api/tables', () => ({ fetchZones: jest.fn(), updateZone: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

const MARGIN = 0.3;
const VB_W = 1000 / 60 + 2 * MARGIN;
const VB_H = 640 / 60 + 2 * MARGIN;
const PX = 60;

const zoneA = { id: 'zona-a', name: 'Salón', sortOrder: 0, polygon: [[4, 4], [6, 4], [6, 6], [4, 6]] };
const zoneEdge = { id: 'zona-e', name: 'Esquina', sortOrder: 1, polygon: [[0, 0], [2, 0], [2, 2], [0, 2]] };

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

beforeAll(() => {
  (window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;
});

beforeEach(() => {
  jest.resetAllMocks();
  (fetchZones as jest.Mock).mockResolvedValue([zoneA, zoneEdge]);
  (updateZone as jest.Mock).mockImplementation(async (id, input) => ({ id, ...input }));
});

async function openZone(name: RegExp) {
  const Page = require('../src/app/(panel)/mesas/espacios/page').default;
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name }));
  const svg = document.querySelector('svg[aria-label^="Plano"]') as SVGSVGElement;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: VB_W * PX, height: VB_H * PX, right: VB_W * PX, bottom: VB_H * PX, x: 0, y: 0, toJSON: () => ({}) });
  return svg;
}

describe('foco del vértice (H1)', () => {
  test('quita el outline del navegador y dibuja un anillo propio solo con foco', async () => {
    await openZone(/salón/i);
    const vertex = screen.getAllByTestId('space-vertex')[0];
    expect(vertex).toHaveStyle({ outline: 'none' });
    expect(screen.queryByTestId('space-vertex-focus')).toBeNull();
    fireEvent.focus(vertex);
    const ring = screen.getByTestId('space-vertex-focus');
    expect(ring).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(ring.getAttribute('stroke')).toMatch(/var\(--bento-/);
    expect(Number(ring.getAttribute('r'))).toBeGreaterThan(Number(vertex.getAttribute('r')));
    expect(ring).toHaveAttribute('cx', '4');
    fireEvent.blur(vertex);
    expect(screen.queryByTestId('space-vertex-focus')).toBeNull();
  });
});

describe('margen del viewBox (H2)', () => {
  test('un vértice en 0,0 queda dentro del viewBox y se guarda como 0,0', async () => {
    const svg = await openZone(/esquina/i);
    const [x, y, w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(x).toBeCloseTo(-MARGIN);
    expect(y).toBeCloseTo(-MARGIN);
    expect(w).toBeCloseTo(VB_W);
    expect(h).toBeCloseTo(VB_H);
    const vertex = screen.getAllByTestId('space-vertex')[0];
    const r = Number(vertex.getAttribute('r'));
    expect(Number(vertex.getAttribute('cx')) - r).toBeGreaterThanOrEqual(x);
    expect(Number(vertex.getAttribute('cy')) - r).toBeGreaterThanOrEqual(y);
    fireEvent.keyDown(screen.getAllByTestId('space-vertex')[2], { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(updateZone).toHaveBeenCalled());
    expect((updateZone as jest.Mock).mock.calls[0][1].polygon[0]).toEqual([0, 0]);
  });
});

describe.each(['mouse', 'touch'])('arrastre con puntero (%s)', (pointerType) => {
  test('mueve el vértice con snap descontando el margen y lo suelta', async () => {
    const svg = await openZone(/salón/i);
    expect(svg).toHaveClass('space-canvas');
    expect(document.querySelector('style')?.textContent).toMatch(/\.space-canvas\s*\{[^}]*touch-action:\s*none/);
    const vertex = screen.getAllByTestId('space-vertex')[0];
    fireEvent(vertex, new TestPointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 4.3 * PX, clientY: 4.3 * PX, pointerType }));
    fireEvent(svg, new TestPointerEvent('pointermove', { bubbles: true, clientX: 5.3 * PX, clientY: 4.8 * PX, pointerType }));
    const moved = screen.getAllByTestId('space-vertex')[0];
    expect(moved).toHaveAttribute('data-x', '5');
    expect(moved).toHaveAttribute('data-y', '4.5');
    fireEvent(svg, new TestPointerEvent('pointerup', { bubbles: true, pointerType }));
    fireEvent(svg, new TestPointerEvent('pointermove', { bubbles: true, clientX: 5 * PX, clientY: 5 * PX, pointerType }));
    expect(screen.getAllByTestId('space-vertex')[0]).toHaveAttribute('data-x', '5');
  });
});
