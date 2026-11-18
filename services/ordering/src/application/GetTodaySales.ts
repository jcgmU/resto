import { dayRangeInTimeZone, salesSummaryFromAggregate, SalesSummary } from '../domain/salesSummary';
import { SalesReportPort } from './ports/SalesReportPort';

export class GetTodaySales {
  constructor(private readonly payments: SalesReportPort) {}

  async execute(tenantId: string, timeZone: string, now: Date = new Date()): Promise<SalesSummary> {
    const { from, to } = dayRangeInTimeZone(timeZone, now);
    const { total, tickets } = await this.payments.sumPaymentsBetween(tenantId, from, to);
    return salesSummaryFromAggregate(total, tickets);
  }
}
