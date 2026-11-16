import { TransactionCoordinator } from '../../application/ports/TransactionCoordinator';

export class InMemoryTransactionCoordinator implements TransactionCoordinator {
  private locks = new Map<string, Promise<void>>();

  async runInSessionLock<T>(
    tenantId: string,
    sessionId: string,
    fn: (tx?: any) => Promise<T>
  ): Promise<T> {
    const key = `${tenantId}:${sessionId}`;
    const prev = this.locks.get(key) || Promise.resolve();

    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(key, prev.then(() => current));

    await prev;
    try {
      return await fn();
    } finally {
      release!();
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    }
  }
}
