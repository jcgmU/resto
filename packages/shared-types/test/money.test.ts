import { DEFAULT_CURRENCY, DEFAULT_LOCALE, formatCOP, formatMoney, isValidCurrency, isValidLocale } from '../src';

const norm = (text: string) => text.replace(/ /g, ' ');

describe('formatMoney', () => {
  test('COP/es-CO se ve igual que formatCOP (sin decimales)', () => {
    for (const value of [0, 12500, 1234567, 35000.9, -4200]) {
      expect(formatMoney(value, { currency: 'COP', locale: 'es-CO' })).toBe(formatCOP(value));
    }
    expect(norm(formatMoney(12500))).toBe(norm(formatCOP(12500)));
    expect(formatMoney(12500)).toMatch(/12\.500/);
    expect(formatMoney(12500)).not.toMatch(/,/);
  });

  test('USD en en-US usa 2 decimales', () => {
    expect(norm(formatMoney(1234.5, { currency: 'USD', locale: 'en-US' }))).toBe('$1,234.50');
  });

  test('EUR en es-ES usa los separadores del locale', () => {
    expect(norm(formatMoney(1234.5, { currency: 'EUR', locale: 'es-ES' }))).toBe('1234,50 €');
    expect(norm(formatMoney(12345.5, { currency: 'EUR', locale: 'es-ES' }))).toBe('12.345,50 €');
  });

  test('monedas sin decimales (JPY) respetan Intl', () => {
    expect(norm(formatMoney(1500, { currency: 'JPY', locale: 'ja-JP' }))).toMatch(/1,500$/);
  });

  test('acepta string, null, undefined y NaN como 0 o número', () => {
    expect(formatMoney('35000')).toMatch(/35\.000/);
    for (const empty of [null, undefined, 'invalid', NaN]) {
      expect(formatMoney(empty as never)).toBe(formatCOP(0));
    }
  });

  test('moneda o locale inválidos caen a COP/es-CO sin lanzar', () => {
    expect(formatMoney(12500, { currency: 'XXXX', locale: 'es-CO' })).toBe(formatCOP(12500));
    expect(formatMoney(12500, { currency: 'COP', locale: 'no_valido!' })).toBe(formatCOP(12500));
  });
});

describe('validadores', () => {
  test('defaults', () => {
    expect(DEFAULT_CURRENCY).toBe('COP');
    expect(DEFAULT_LOCALE).toBe('es-CO');
  });

  test('isValidCurrency exige ISO 4217 soportado', () => {
    expect(isValidCurrency('COP')).toBe(true);
    expect(isValidCurrency('USD')).toBe(true);
    for (const bad of ['cop', 'XXXX', 'ZZZ', '', 'US', null, undefined, 12]) expect(isValidCurrency(bad as never)).toBe(false);
  });

  test('isValidLocale exige BCP 47 canónico', () => {
    expect(isValidLocale('es-CO')).toBe(true);
    expect(isValidLocale('en-US')).toBe(true);
    for (const bad of ['', 'es_CO', 'no valido', '123', null, undefined, 5]) expect(isValidLocale(bad as never)).toBe(false);
  });
});
