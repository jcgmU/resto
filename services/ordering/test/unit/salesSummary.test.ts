import { salesSummary, dayRangeInTimeZone } from '../../src/domain/salesSummary';

describe('ventas del día', () => {
  it('devuelve ceros cuando no hay pagos', () => {
    expect(salesSummary([])).toEqual({ total: '0.00', tickets: 0, averageTicket: '0.00' });
  });

  it('suma pagos y redondea el promedio con precisión decimal', () => {
    expect(salesSummary([{ amount: '0.10' }])).toEqual({ total: '0.10', tickets: 1, averageTicket: '0.10' });
    expect(salesSummary([{ amount: '0.10' }, { amount: '0.20' }, { amount: '0.21' }])).toEqual({ total: '0.51', tickets: 3, averageTicket: '0.17' });
    expect(salesSummary([{ amount: '0.01' }, { amount: '0.02' }])).toEqual({ total: '0.03', tickets: 2, averageTicket: '0.02' });
  });

  it('calcula el día civil local como rango semiabierto distinto de UTC', () => {
    const { from, to } = dayRangeInTimeZone('America/Bogota', new Date('2026-11-17T02:00:00Z'));
    expect(from.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-17T05:00:00.000Z');
  });

  it('respeta días de 23 y 25 horas al cambiar horario de verano', () => {
    const spring = dayRangeInTimeZone('America/New_York', new Date('2026-03-08T12:00:00Z'));
    expect(spring.from.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(spring.to.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    const fall = dayRangeInTimeZone('America/New_York', new Date('2026-11-01T12:00:00Z'));
    expect(fall.from.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(fall.to.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('rechaza una zona inválida como error de validación', () => {
    expect(() => dayRangeInTimeZone('No/Existe', new Date('2026-11-17T12:00:00Z'))).toThrow('VALIDATION_ERROR');
    expect(() => dayRangeInTimeZone('', new Date('2026-11-17T12:00:00Z'))).toThrow('VALIDATION_ERROR');
    expect(() => dayRangeInTimeZone('+05:30', new Date('2026-11-17T12:00:00Z'))).toThrow('VALIDATION_ERROR');
  });
});
