import Redis from 'ioredis';
import { ZoneRepository, ZoneDTO } from '@packages/shared-types';
import { RedisKeys } from './keys';

export class RedisZoneRepository implements ZoneRepository {
  constructor(private readonly redis: Redis) {}

  async save(tenantId: string, zone: ZoneDTO): Promise<ZoneDTO> {
    const key = RedisKeys.zone(zone.id);
    const setKey = RedisKeys.tenantZones(tenantId);

    const fields: Record<string, string> = {
      id: zone.id,
      tenantId,
      name: zone.name,
      sortOrder: String(zone.sortOrder ?? 0),
    };

    await this.redis
      .multi()
      .hset(key, fields)
      .sadd(setKey, zone.id)
      .exec();

    return zone;
  }

  async findById(tenantId: string, zoneId: string): Promise<ZoneDTO | null> {
    const key = RedisKeys.zone(zoneId);
    const raw = await this.redis.hgetall(key);
    if (!raw || !raw.id || raw.tenantId !== tenantId) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenantId,
      name: raw.name,
      sortOrder: Number(raw.sortOrder ?? 0),
    };
  }

  async listByTenant(tenantId: string): Promise<ZoneDTO[]> {
    const setKey = RedisKeys.tenantZones(tenantId);
    const zoneIds = await this.redis.smembers(setKey);
    if (!zoneIds.length) return [];

    const pipeline = this.redis.pipeline();
    zoneIds.forEach((id) => pipeline.hgetall(RedisKeys.zone(id)));
    const results = await pipeline.exec();

    const zones: ZoneDTO[] = [];
    for (const [err, raw] of results || []) {
      if (!err && raw && (raw as Record<string, string>).id && (raw as Record<string, string>).tenantId === tenantId) {
        const item = raw as Record<string, string>;
        zones.push({
          id: item.id,
          tenantId: item.tenantId,
          name: item.name,
          sortOrder: Number(item.sortOrder ?? 0),
        });
      }
    }

    zones.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });

    return zones;
  }

  async delete(tenantId: string, zoneId: string): Promise<void> {
    const key = RedisKeys.zone(zoneId);
    const setKey = RedisKeys.tenantZones(tenantId);
    await this.redis
      .multi()
      .del(key)
      .srem(setKey, zoneId)
      .exec();
  }
}
