export const DEFAULT_CURRENCY = 'COP';
export const DEFAULT_LOCALE = 'es-CO';

export interface MoneyFormat {
  currency?: string;
  locale?: string;
}

export function isValidCurrency(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) return false;
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('currency');
  return supported ? supported.includes(value) : true;
}

export function isValidLocale(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) return false;
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

/** COP se muestra sin decimales (como siempre); el resto de monedas usa los decimales de Intl. */
export function formatMoney(value: number | string | null | undefined, format: MoneyFormat = {}): string {
  const currency = isValidCurrency(format.currency) ? format.currency : DEFAULT_CURRENCY;
  const locale = isValidLocale(format.locale) ? format.locale : DEFAULT_LOCALE;
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  const options: Intl.NumberFormatOptions = { style: 'currency', currency };
  if (currency === 'COP') {
    options.maximumFractionDigits = 0;
    options.minimumFractionDigits = 0;
  }
  return new Intl.NumberFormat(locale, options).format(Number.isNaN(num) ? 0 : num);
}

export function formatCOP(value: number | string | null | undefined): string {
  return formatMoney(value, { currency: 'COP', locale: 'es-CO' });
}
