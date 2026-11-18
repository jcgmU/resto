import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  shortId,
  formatOrderNumber,
  getTableDisplayName,
  tableDisplayName,
} from '../src/kit/labels';

describe('kit labels and id helpers (H7)', () => {
  test('ORDER_STATUS_LABELS maps all domain states to Spanish', () => {
    expect(ORDER_STATUS_LABELS.PLACED).toBe('Recibido');
    expect(ORDER_STATUS_LABELS.IN_KITCHEN).toBe('En cocina');
    expect(ORDER_STATUS_LABELS.READY).toBe('Listo');
    expect(ORDER_STATUS_LABELS.DELIVERED).toBe('Entregado');
    expect(ORDER_STATUS_LABELS.CANCELLED).toBe('Cancelado');
  });

  test('PAYMENT_METHOD_LABELS maps payment methods to Spanish', () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe('Efectivo');
    expect(PAYMENT_METHOD_LABELS.CARD).toBe('Tarjeta');
    expect(PAYMENT_METHOD_LABELS.OTHER).toBe('Otro');
  });

  test('shortId extracts clean 6-char id without leading hyphens or prefixes', () => {
    expect(shortId('ord-zc8lj')).toBe('zc8lj');
    expect(shortId('order-zc8lj')).toBe('zc8lj');
    expect(shortId('table-1791762875669-723')).toBe('669723');
    expect(shortId('e3d74910-c11a-4632-a567-27b233a780fa')).toBe('a780fa');
    expect(shortId('')).toBe('');
    expect(shortId(null)).toBe('');
    expect(shortId(undefined)).toBe('');
  });

  test('formatOrderNumber formats order id without loose hyphens like #-zc8lj', () => {
    expect(formatOrderNumber('ord-zc8lj')).toBe('Orden #zc8lj');
    expect(formatOrderNumber('order-zc8lj')).toBe('Orden #zc8lj');
    expect(formatOrderNumber('e3d74910-c11a-4632-a567-27b233a780fa')).toBe('Orden #a780fa');
  });

  test('getTableDisplayName resolves table label or falls back to shortId', () => {
    const tables = [
      { tableId: 't-1', label: 'Mesa 1' },
      { tableId: 't-2', label: 'Terraza 4' },
    ];
    expect(getTableDisplayName('t-1', tables)).toBe('Mesa 1');
    expect(getTableDisplayName('t-2', tables)).toBe('Terraza 4');
    expect(getTableDisplayName('t-unknown', tables)).toBe('Mesa · nknown');
    expect(getTableDisplayName('table-1791762875669-723', [])).toBe('Mesa · 669723');
    expect(getTableDisplayName('Mesa 4')).toBe('Mesa 4');
    expect(getTableDisplayName(null)).toBe('');
  });

  test('tableDisplayName antepone "Mesa" solo si la etiqueta no empieza ya por "mesa"', () => {
    expect(tableDisplayName('1')).toBe('Mesa 1');
    expect(tableDisplayName('  12 ')).toBe('Mesa 12');
    expect(tableDisplayName('Mesa 3')).toBe('Mesa 3');
    expect(tableDisplayName('mesa 3')).toBe('mesa 3');
    expect(tableDisplayName('MESA 4')).toBe('MESA 4');
    expect(tableDisplayName('Terraza 2')).toBe('Mesa Terraza 2');
    expect(tableDisplayName('')).toBe('');
    expect(tableDisplayName(null)).toBe('');
  });
});
