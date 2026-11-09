import Redis from 'ioredis';
import { TableRepository, TableDTO, DomainError } from '@packages/shared-types';
import { RedisKeys } from './keys';

const LUA_CREATE_MANY = `
local setKey = KEYS[1]
local tenantId = ARGV[1]
local newTables = cjson.decode(ARGV[2])
local maxLimit = tonumber(ARGV[3]) or 500

local function normalize_legacy(label)
  if not label then return '' end
  local s = string.gsub(label, "^%s*(.-)%s*$", "%1")
  s = string.lower(s)
  s = string.gsub(s, "Á", "á")
  s = string.gsub(s, "É", "é")
  s = string.gsub(s, "Í", "í")
  s = string.gsub(s, "Ó", "ó")
  s = string.gsub(s, "Ú", "ú")
  s = string.gsub(s, "Ü", "ü")
  s = string.gsub(s, "Ñ", "ñ")
  return s
end

local existingIds = redis.call('SMEMBERS', setKey)
local existingLabels = {}
local liveCount = 0

for _, exId in ipairs(existingIds) do
  local raw = redis.call('GET', 'table:' .. tenantId .. ':' .. exId)
  if raw then
    local ex = cjson.decode(raw)
    if ex.status ~= 'deleted' then
      liveCount = liveCount + 1
      local lk = ex.labelKey
      if (not lk or lk == '') and ex.label then
        lk = normalize_legacy(ex.label)
      end
      if lk and lk ~= '' then
        existingLabels[lk] = true
      end
    end
  end
end

if liveCount + #newTables > maxLimit then
  return cjson.encode({
    err = 'TABLE_LIMIT_EXCEEDED',
    current = liveCount,
    requested = #newTables,
    max = maxLimit
  })
end

local seenInBatch = {}
local conflicts = {}
local hasConflict = false

for _, item in ipairs(newTables) do
  local lk = item.labelKey
  if (not lk or lk == '') and item.label then
    lk = normalize_legacy(item.label)
  end
  if lk and (seenInBatch[lk] or existingLabels[lk]) then
    hasConflict = true
    table.insert(conflicts, lk)
  else
    if lk then
      seenInBatch[lk] = true
    end
  end
end

if hasConflict then
  return cjson.encode({
    err = 'TABLE_LABEL_TAKEN',
    conflicts = conflicts
  })
end

for _, item in ipairs(newTables) do
  local tableKey = 'table:' .. tenantId .. ':' .. item.tableId
  redis.call('SET', tableKey, cjson.encode(item))
  redis.call('SADD', setKey, item.tableId)
end

return cjson.encode({ ok = true })
`;

const LUA_UPDATE_MANY = `
local setKey = KEYS[1]
local tenantId = ARGV[1]
local updates = cjson.decode(ARGV[2])
local nowIso = ARGV[3]

local function normalize_legacy(label)
  if not label then return '' end
  local s = string.gsub(label, "^%s*(.-)%s*$", "%1")
  s = string.lower(s)
  s = string.gsub(s, "Á", "á")
  s = string.gsub(s, "É", "é")
  s = string.gsub(s, "Í", "í")
  s = string.gsub(s, "Ó", "ó")
  s = string.gsub(s, "Ú", "ú")
  s = string.gsub(s, "Ü", "ü")
  s = string.gsub(s, "Ñ", "ñ")
  return s
end

local updateMap = {}
for _, u in ipairs(updates) do
  if u.status == 'deleted' then
    return cjson.encode({ err = 'VALIDATION_ERROR', message = 'Cannot set status to deleted in updateMany' })
  end
  local tableKey = 'table:' .. tenantId .. ':' .. u.tableId
  local raw = redis.call('GET', tableKey)
  if not raw then
    return cjson.encode({ err = 'TABLE_NOT_FOUND', tableId = u.tableId })
  end
  local tableObj = cjson.decode(raw)
  if tableObj.tenantId ~= tenantId or tableObj.status == 'deleted' then
    return cjson.encode({ err = 'TABLE_NOT_FOUND', tableId = u.tableId })
  end
  updateMap[u.tableId] = u
end

local allIds = redis.call('SMEMBERS', setKey)
local finalLabels = {}
local conflicts = {}
local hasConflict = false

for _, tId in ipairs(allIds) do
  local tableKey = 'table:' .. tenantId .. ':' .. tId
  local raw = redis.call('GET', tableKey)
  if raw then
    local tableObj = cjson.decode(raw)
    if tableObj.status ~= 'deleted' then
      local u = updateMap[tId]
      local finalLabelKey = nil
      if u and u.label ~= nil then
        finalLabelKey = u.labelKey
        if (not finalLabelKey or finalLabelKey == '') and u.label then
          finalLabelKey = normalize_legacy(u.label)
        end
      else
        finalLabelKey = tableObj.labelKey
        if (not finalLabelKey or finalLabelKey == '') and tableObj.label then
          finalLabelKey = normalize_legacy(tableObj.label)
        end
      end

      if finalLabelKey and finalLabelKey ~= '' then
        local existingOwner = finalLabels[finalLabelKey]
        if existingOwner and existingOwner ~= tId then
          hasConflict = true
          table.insert(conflicts, finalLabelKey)
        else
          finalLabels[finalLabelKey] = tId
        end
      end
    end
  end
end

if hasConflict then
  return cjson.encode({ err = 'TABLE_LABEL_TAKEN', conflicts = conflicts })
end

local updatedList = {}
for _, u in ipairs(updates) do
  local tableKey = 'table:' .. tenantId .. ':' .. u.tableId
  local raw = redis.call('GET', tableKey)
  local tableObj = cjson.decode(raw)
  if u.label ~= nil then
    tableObj.label = u.label
    tableObj.labelKey = u.labelKey or normalize_legacy(u.label)
  end
  if u.status ~= nil then
    tableObj.status = u.status
  end
  tableObj.updatedAt = nowIso
  redis.call('SET', tableKey, cjson.encode(tableObj))
  table.insert(updatedList, tableObj)
end

return cjson.encode({ ok = true, tables = updatedList })
`;

const LUA_SOFT_DELETE_MANY = `
local setKey = KEYS[1]
local tenantId = ARGV[1]
local items = cjson.decode(ARGV[2])

local deleted = {}
local failed = {}

for _, item in ipairs(items) do
  local tableId = item.tableId
  local tableKey = 'table:' .. tenantId .. ':' .. tableId
  local tableRaw = redis.call('GET', tableKey)

  if not tableRaw then
    table.insert(failed, { tableId = tableId, code = 'TABLE_NOT_FOUND' })
  else
    local tableObj = cjson.decode(tableRaw)
    if tableObj.tenantId ~= tenantId or tableObj.status == 'deleted' then
      table.insert(failed, { tableId = tableId, code = 'TABLE_NOT_FOUND' })
    else
      local pointerKey = 'tenant:' .. tenantId .. ':table:' .. tableId .. ':session'
      local activeSessionId = redis.call('GET', pointerKey)
      local hasActiveSession = false

      if activeSessionId then
        local sessionKey = 'session:' .. activeSessionId
        local sessionRaw = redis.call('GET', sessionKey)
        if sessionRaw then
          local sessionObj = cjson.decode(sessionRaw)
          if sessionObj.status == 'active' and sessionObj.tenantId == tenantId then
            hasActiveSession = true
          end
        end
      end

      if hasActiveSession then
        table.insert(failed, { tableId = tableId, code = 'TABLE_HAS_ACTIVE_SESSION' })
      else
        if activeSessionId then
          redis.call('DEL', pointerKey)
        end
        tableObj.status = 'deleted'
        tableObj.deletedAt = item.deletedAt
        tableObj.qrKey = item.newQrKey
        tableObj.updatedAt = item.deletedAt
        redis.call('SET', tableKey, cjson.encode(tableObj))
        redis.call('SREM', setKey, tableId)
        table.insert(deleted, tableId)
      end
    end
  end
end

return cjson.encode({ deleted = deleted, failed = failed })
`;

export class RedisTableRepository implements TableRepository {
  constructor(private readonly redis: Redis) {}

  async save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO> {
    const key = RedisKeys.table(tenantId, table.tableId);
    const setKey = RedisKeys.tenantTables(tenantId);

    const labelKey = table.label
      ? table.label.trim().normalize('NFC').toLocaleLowerCase('es')
      : undefined;
    const record = {
      ...table,
      tenantId,
      ...(labelKey ? { labelKey } : {}),
    };
    const payload = JSON.stringify(record);

    const multi = this.redis.multi().set(key, payload);
    if (table.status === 'deleted') {
      multi.srem(setKey, table.tableId);
    } else {
      multi.sadd(setKey, table.tableId);
    }
    await multi.exec();

    const { qrKey: _, labelKey: __, ...dto } = record as any;
    return dto;
  }

  async findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null> {
    const key = RedisKeys.table(tenantId, tableId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.tenantId !== tenantId) return null;
    return parsed;
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
        if (parsed.status === 'deleted') continue;
        const { qrKey: _, labelKey: __, ...dto } = parsed;
        tables.push(dto);
      }
    }
    return tables;
  }

  async createMany(
    tenantId: string,
    tables: Array<TableDTO & { qrKey: string; labelKey?: string }>
  ): Promise<TableDTO[]> {
    if (!tables.length) return [];

    const preparedTables = tables.map((t) => ({
      ...t,
      tenantId,
      labelKey: t.labelKey || t.label.trim().normalize('NFC').toLocaleLowerCase('es'),
    }));

    const setKey = RedisKeys.tenantTables(tenantId);
    const rawRes = await this.redis.eval(
      LUA_CREATE_MANY,
      1,
      setKey,
      tenantId,
      JSON.stringify(preparedTables),
      500
    );

    const res = JSON.parse(rawRes as string);

    if (res.err === 'TABLE_LIMIT_EXCEEDED') {
      throw new DomainError(
        'TABLE_LIMIT_EXCEEDED',
        'Maximum of 500 live tables per tenant exceeded',
        {
          current: res.current,
          requested: res.requested,
          max: res.max,
        }
      );
    }

    if (res.err === 'TABLE_LABEL_TAKEN') {
      const conflicts = Array.isArray(res.conflicts)
        ? Array.from(new Set(res.conflicts))
        : [];
      throw new DomainError('TABLE_LABEL_TAKEN', 'Table label already exists', {
        conflicts,
      });
    }

    return preparedTables.map(({ qrKey: _, labelKey: __, ...dto }) => dto);
  }

  async updateMany(
    tenantId: string,
    updates: Array<{
      tableId: string;
      label?: string;
      labelKey?: string;
      status?: 'active' | 'inactive';
    }>
  ): Promise<TableDTO[]> {
    if (!updates.length) return [];

    const preparedUpdates = updates.map((u) => {
      let labelKey = u.labelKey;
      if (!labelKey && u.label !== undefined) {
        labelKey = u.label.trim().normalize('NFC').toLocaleLowerCase('es');
      }
      return {
        ...u,
        ...(labelKey !== undefined ? { labelKey } : {}),
      };
    });

    const setKey = RedisKeys.tenantTables(tenantId);
    const nowIso = new Date().toISOString();

    const rawRes = await this.redis.eval(
      LUA_UPDATE_MANY,
      1,
      setKey,
      tenantId,
      JSON.stringify(preparedUpdates),
      nowIso
    );

    const res = JSON.parse(rawRes as string);

    if (res.err === 'TABLE_NOT_FOUND') {
      throw new DomainError(
        'TABLE_NOT_FOUND',
        `TABLE_NOT_FOUND: Table ${res.tableId} not found`
      );
    }

    if (res.err === 'VALIDATION_ERROR') {
      throw new DomainError('VALIDATION_ERROR', res.message);
    }

    if (res.err === 'TABLE_LABEL_TAKEN') {
      const conflicts = Array.isArray(res.conflicts)
        ? Array.from(new Set(res.conflicts))
        : [];
      throw new DomainError('TABLE_LABEL_TAKEN', 'Table label already exists', {
        conflicts,
      });
    }

    const updatedTables: any[] = Array.isArray(res.tables) ? res.tables : [];
    return updatedTables.map(({ qrKey: _, labelKey: __, ...dto }) => dto);
  }

  async softDeleteMany(
    tenantId: string,
    items: Array<{ tableId: string; deletedAt: string; newQrKey: string }>
  ): Promise<{
    deleted: string[];
    failed: Array<{ tableId: string; code: 'TABLE_HAS_ACTIVE_SESSION' | 'TABLE_NOT_FOUND' }>;
  }> {
    if (!items.length) return { deleted: [], failed: [] };

    const setKey = RedisKeys.tenantTables(tenantId);
    const rawRes = await this.redis.eval(
      LUA_SOFT_DELETE_MANY,
      1,
      setKey,
      tenantId,
      JSON.stringify(items)
    );

    const res = JSON.parse(rawRes as string);

    return {
      deleted: Array.isArray(res.deleted) ? res.deleted : [],
      failed: Array.isArray(res.failed) ? res.failed : [],
    };
  }
}
