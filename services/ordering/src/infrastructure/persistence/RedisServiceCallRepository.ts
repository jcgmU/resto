import Redis from 'ioredis';
import {
  ServiceCallDTO,
  ServiceCallRepository,
  ServiceCallStatus,
} from '@packages/shared-types';

export class RedisServiceCallRepository implements ServiceCallRepository {
  constructor(private readonly redis: Redis) {}

  private getCallKey(tenantId: string, callId: string): string {
    return `service-call:${tenantId}:${callId}`;
  }

  private getPendingSetKey(tenantId: string): string {
    return `tenant:${tenantId}:service-calls:pending`;
  }

  async save(tenantId: string, call: ServiceCallDTO, ttlSeconds: number): Promise<ServiceCallDTO> {
    const key = this.getCallKey(tenantId, call.callId);
    const data: Record<string, string> = {
      callId: call.callId,
      tenantId: call.tenantId,
      sessionId: call.sessionId,
      tableId: call.tableId,
      type: call.type || 'GENERIC',
      status: call.status,
      createdAt: call.createdAt,
    };
    if (call.note) {
      data.note = call.note;
    }
    if (call.resolvedAt) {
      data.resolvedAt = call.resolvedAt;
    }

    const multi = this.redis.multi();
    multi.hset(key, data);
    multi.expire(key, ttlSeconds);
    if (call.status === 'pending') {
      multi.sadd(this.getPendingSetKey(tenantId), call.callId);
    } else {
      multi.srem(this.getPendingSetKey(tenantId), call.callId);
    }
    await multi.exec();

    return {
      ...call,
      type: call.type || 'GENERIC',
    };
  }

  async findById(tenantId: string, callId: string): Promise<ServiceCallDTO | null> {
    const key = this.getCallKey(tenantId, callId);
    const raw = await this.redis.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) {
      return null;
    }

    return {
      callId: raw.callId,
      tenantId: raw.tenantId,
      sessionId: raw.sessionId,
      tableId: raw.tableId,
      type: (raw.type as any) || 'GENERIC',
      note: raw.note || undefined,
      status: raw.status as ServiceCallStatus,
      createdAt: raw.createdAt,
      resolvedAt: raw.resolvedAt || undefined,
    };
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: ServiceCallStatus }
  ): Promise<ServiceCallDTO[]> {
    if (filter?.status === 'pending' || !filter?.status) {
      const pendingIds = await this.redis.smembers(this.getPendingSetKey(tenantId));
      if (!pendingIds || pendingIds.length === 0) {
        return [];
      }

      const results: ServiceCallDTO[] = [];
      const toRemove: string[] = [];

      for (const id of pendingIds) {
        const call = await this.findById(tenantId, id);
        if (!call || call.status !== 'pending') {
          toRemove.push(id);
        } else {
          results.push(call);
        }
      }

      if (toRemove.length > 0) {
        await this.redis.srem(this.getPendingSetKey(tenantId), ...toRemove);
      }

      return results.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return [];
  }

  async resolve(tenantId: string, callId: string, resolvedAt: Date): Promise<ServiceCallDTO> {
    const key = this.getCallKey(tenantId, callId);
    const resolvedIso = resolvedAt.toISOString();

    const multi = this.redis.multi();
    multi.hset(key, 'status', 'resolved', 'resolvedAt', resolvedIso);
    multi.srem(this.getPendingSetKey(tenantId), callId);
    await multi.exec();

    const updated = await this.findById(tenantId, callId);
    if (!updated) {
      throw new Error(`ServiceCall ${callId} not found`);
    }
    return updated;
  }
}
