import Redis from 'ioredis';
import { EventSubscriber, OrderEvent, ServiceCallEvent, TableStatusChangedEvent } from '@packages/shared-types';

export class RedisEventSubscriber implements EventSubscriber {
  private dedicatedRedis: Redis | null = null;
  private orderHandlers: ((event: OrderEvent) => void)[] = [];
  private serviceCallHandlers: ((event: ServiceCallEvent) => void)[] = [];
  private tableStatusHandlers: ((event: TableStatusChangedEvent) => void)[] = [];
  private isRunning = false;

  constructor(private readonly redisUrl: string) {}

  onOrderEvent(handler: (event: OrderEvent) => void): void {
    this.orderHandlers.push(handler);
  }

  onServiceCallEvent(handler: (event: ServiceCallEvent) => void): void {
    this.serviceCallHandlers.push(handler);
  }

  onTableStatusChanged(handler: (event: TableStatusChangedEvent) => void): void {
    this.tableStatusHandlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.dedicatedRedis = new Redis(this.redisUrl);
    this.isRunning = true;

    this.dedicatedRedis.on('pmessage', (_pattern, channel, message) => {
      try {
        const parsed = JSON.parse(message);
        if (channel.endsWith(':order-events')) {
          for (const handler of this.orderHandlers) {
            handler(parsed);
          }
        } else if (channel.endsWith(':service-calls')) {
          for (const handler of this.serviceCallHandlers) {
            handler(parsed);
          }
        } else if (channel.endsWith(':session-events')) {
          for (const handler of this.tableStatusHandlers) {
            handler(parsed);
          }
        }
      } catch (err) {
        // Ignorar mensajes corruptos
      }
    });

    await this.dedicatedRedis.psubscribe(
      'tenant:*:order-events',
      'tenant:*:service-calls',
      'tenant:*:session-events'
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.dedicatedRedis) return;
    try {
      await this.dedicatedRedis.punsubscribe();
      this.dedicatedRedis.disconnect();
    } catch {
      // Ignore disconnect errors
    } finally {
      this.dedicatedRedis = null;
      this.isRunning = false;
    }
  }
}
