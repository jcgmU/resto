import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SlaDot, computeSlaStatus } from '../src/kit/SlaDot';

describe('U15 [NUEVA R2]: SlaDot Indicador Semáforo', () => {
  const baseMs = new Date('2026-10-21T12:00:00Z').getTime();

  test('computeSlaStatus: verde cuando el tiempo es < 75% del SLA efectivo', () => {
    // SLA = 20 min. Transcurridos 10 min (50%) -> verde
    const created = new Date(baseMs);
    const nowMs = baseMs + 10 * 60 * 1000;
    const res = computeSlaStatus(created, 20, 0, nowMs);

    expect(res.tone).toBe('green');
    expect(res.effectiveSlaMinutes).toBe(20);
    expect(res.elapsedMinutes).toBe(10);
    expect(res.percentage).toBe(0.5);
  });

  test('computeSlaStatus: amarillo cuando el tiempo es >= 75% y < 100% del SLA efectivo con delay', () => {
    // Base 15 min + delay 5 min = 20 min SLA efectivo. Transcurridos 16 min (80%) -> amarillo
    const created = new Date(baseMs);
    const nowMs = baseMs + 16 * 60 * 1000;
    const res = computeSlaStatus(created, 15, 5, nowMs);

    expect(res.tone).toBe('yellow');
    expect(res.effectiveSlaMinutes).toBe(20);
    expect(res.percentage).toBe(0.8);
  });

  test('computeSlaStatus: rojo cuando el tiempo es >= 100% del SLA efectivo', () => {
    // Base 18 min + delay 0 = 18 min. Transcurridos 20 min -> rojo
    const created = new Date(baseMs);
    const nowMs = baseMs + 20 * 60 * 1000;
    const res = computeSlaStatus(created, 18, 0, nowMs);

    expect(res.tone).toBe('red');
    expect(res.percentage).toBeGreaterThanOrEqual(1.0);
  });

  test('SlaDot renderiza el semáforo con data-tone correspondiente', () => {
    const recent = new Date(Date.now() - 2 * 60 * 1000); // 2 min ago
    render(<SlaDot createdAt={recent} estimatedPrepMinutes={18} />);

    const dot = screen.getByTestId('sla-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('data-tone', 'green');
  });
});
