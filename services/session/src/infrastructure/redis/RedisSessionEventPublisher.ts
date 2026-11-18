import Redis from 'ioredis';
import { SessionEvent, SessionEventPublisherPort } from '../../domain/events';

export class RedisSessionEventPublisher implements SessionEventPublisherPort {
  constructor(private readonly redis: Redis) {}

  async publishSessionEvent(tenantId: string, event: SessionEvent): Promise<void> {
    try {
      const channel = `tenant:${tenantId}:session-events`;
      await this.redis.publish(channel, JSON.stringify(event));
    } catch (err: any) {
      console.warn(`[RedisSessionEventPublisher] Error publishing event to ${tenantId}: ${err?.message || err}`);
    }
  }
}
