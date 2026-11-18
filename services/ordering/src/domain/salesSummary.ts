import Decimal from 'decimal.js';
import { ValidationError } from './errors';

const Money = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SalesPayment {
  amount: string;
}

export interface SalesSummary {
  total: string;
  tickets: number;
  averageTicket: string;
}

export function salesSummary(payments: readonly SalesPayment[]): SalesSummary {
  const total = payments.reduce((sum, payment) => sum.plus(payment.amount), new Money(0));
  return salesSummaryFromAggregate(total.toString(), payments.length);
}

export function salesSummaryFromAggregate(totalAmount: string, tickets: number): SalesSummary {
  const total = new Money(totalAmount);
  return {
    total: total.toFixed(2),
    tickets,
    averageTicket: tickets === 0 ? '0.00' : total.div(tickets).toFixed(2),
  };
}

export function dayRangeInTimeZone(timeZone: string, now: Date = new Date()): { from: Date; to: Date } {
  let formatter: Intl.DateTimeFormat;
  try {
    if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timeZone) || !Number.isFinite(now.getTime())) throw new RangeError();
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    throw new ValidationError('Zona horaria inválida');
  }

  const localDay = (time: number): number => {
    const parts = formatter.formatToParts(new Date(time));
    const numberOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(numberOf('year'), numberOf('month') - 1, numberOf('day'));
  };

  const today = localDay(now.getTime());
  // Se buscan límites civiles en vez de añadir 24 horas: DST puede producir días de 23 o 25 horas.
  const boundary = (targetDay: number): Date => {
    let low = targetDay - 2 * DAY_MS;
    let high = targetDay + 2 * DAY_MS;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (localDay(middle) < targetDay) low = middle + 1;
      else high = middle;
    }
    return new Date(low);
  };

  return { from: boundary(today), to: boundary(today + DAY_MS) };
}
