export interface SalesReportPort {
  sumPaymentsBetween(tenantId: string, from: Date, to: Date): Promise<{ total: string; tickets: number }>;
}
