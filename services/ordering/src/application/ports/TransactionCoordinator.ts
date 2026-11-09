export interface TransactionCoordinator {
  runInSessionLock<T>(
    tenantId: string,
    sessionId: string,
    fn: (tx?: any) => Promise<T>
  ): Promise<T>;
}
