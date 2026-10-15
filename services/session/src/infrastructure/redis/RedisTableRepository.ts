import Redis from 'ioredis';
import { TableRepository, TableDTO } from '@packages/shared-types';
import { RedisKeys } from './keys';

export class RedisTableRepository implements TableRepository {
  constructor(private readonly redis: Redis) {}

  async save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO> {
    const key = RedisKeys.table(tenantId, table.tableId);
    const setKey = RedisKeys.tenantTables(tenantId);

    const normalizedTable: TableDTO & { qrKey: string } = {
      ...table,
      capacity: table.capacity ?? 4,
      status: table.status ?? 'AVAILABLE',
    };

    const payload = JSON.stringify(normalizedTable);
    await this.redis
      .multi()
      .set(key, payload)
      .sadd(setKey, normalizedTable.tableId)
      .exec();

    const { qrKey: _, ...dto } = normalizedTable;
    return dto;
  }

  async findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null> {
    const key = RedisKeys.table(tenantId, tableId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      capacity: parsed.capacity ?? 4,
      status: parsed.status ?? 'AVAILABLE',
    };
  }

  async listByTenant(tenantId: string): Promise<TableDTO[]> {
    const setKey = RedisKeys.tenantTables(tenantId);
    const tableIds = await this.redis.smembers(setKey);
    if (!tableIds.length) return [];

    const keys = tableIds.map((id) => RedisKeys.table(tenantId, id));
    const rawTables = await this.redis.mget(keys);

    const tables: TableDTO[] = [];
    for (const raw of rawTables) {
      if (raw) {
        const parsed = JSON.parse(raw);
        const { qrKey: _, ...dto } = parsed;
        tables.push({
          ...dto,
          capacity: dto.capacity ?? 4,
          status: dto.status ?? 'AVAILABLE',
        });
      }
    }
    return tables;
  }

  async delete(tenantId: string, tableId: string): Promise<void> {
    const key = RedisKeys.table(tenantId, tableId);
    const setKey = RedisKeys.tenantTables(tenantId);
    await this.redis
      .multi()
      .del(key)
      .srem(setKey, tableId)
      .exec();
  }
}
