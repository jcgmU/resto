import Redis from 'ioredis';
import { TableSessionRepository, TableSessionDTO, DomainError } from '@packages/shared-types';
import { RedisKeys } from './keys';

const LUA_SAVE_ACTIVE = `
local pointerKey = KEYS[1]
local sessionKey = KEYS[2]
local setKey = KEYS[3]
local tableKey = KEYS[4]

local candidateId = ARGV[1]
local candidatePayload = ARGV[2]
local ttl = tonumber(ARGV[3])
local tenantId = ARGV[4]

local tableRaw = redis.call('GET', tableKey)
if not tableRaw then
  return redis.error_reply('TABLE_NOT_FOUND')
end

local tableObj = cjson.decode(tableRaw)
if tableObj.tenantId ~= tenantId or tableObj.status == 'deleted' then
  return redis.error_reply('TABLE_NOT_FOUND')
end

if tableObj.status == 'DISABLED' or tableObj.status == 'inactive' then
  return redis.error_reply('TABLE_INACTIVE')
end

local existingSessionId = redis.call('GET', pointerKey)
if existingSessionId then
  local existingSessionKey = 'session:' .. existingSessionId
  local existingRaw = redis.call('GET', existingSessionKey)
  if existingRaw then
    local existing = cjson.decode(existingRaw)
    if (existing.status == 'active' or existing.status == 'billRequested') and existing.tenantId == tenantId then
      redis.call('EXPIRE', existingSessionKey, ttl)
      redis.call('EXPIRE', pointerKey, ttl)
      return existingRaw
    end
  end
end

redis.call('SET', sessionKey, candidatePayload, 'EX', ttl)
redis.call('SET', pointerKey, candidateId, 'EX', ttl)
redis.call('SADD', setKey, candidateId)
return candidatePayload
`;

const LUA_SAVE_INACTIVE = `
local pointerKey = KEYS[1]
local sessionKey = KEYS[2]
local setKey = KEYS[3]

local sessionId = ARGV[1]
local payload = ARGV[2]
local ttl = tonumber(ARGV[3])

redis.call('SET', sessionKey, payload, 'EX', ttl)
redis.call('SADD', setKey, sessionId)
if redis.call('GET', pointerKey) == sessionId then
  redis.call('DEL', pointerKey)
end
return payload
`;

const LUA_CLOSE = `
local sessionKey = KEYS[1]
local tenantId = ARGV[1]
local sessionId = ARGV[2]
local closedAt = ARGV[3]
local ttl = tonumber(ARGV[4])

local raw = redis.call('GET', sessionKey)
if not raw then
  return redis.error_reply('SESSION_NOT_FOUND')
end

local session = cjson.decode(raw)
if session.tenantId ~= tenantId then
  return redis.error_reply('SESSION_NOT_FOUND')
end

local pointerKey = 'tenant:' .. tenantId .. ':table:' .. session.tableId .. ':session'

if session.status ~= 'closed' then
  session.status = 'closed'
  session.closedAt = closedAt
  local updatedRaw = cjson.encode(session)
  redis.call('SET', sessionKey, updatedRaw, 'EX', ttl)
  if redis.call('GET', pointerKey) == sessionId then
    redis.call('DEL', pointerKey)
  end
  return updatedRaw
else
  if redis.call('GET', pointerKey) == sessionId then
    redis.call('DEL', pointerKey)
  end
  return raw
end
`;

const LUA_TOUCH = `
local sessionKey = KEYS[1]
local tenantId = ARGV[1]
local sessionId = ARGV[2]
local ttl = tonumber(ARGV[3])
local newExpiresAt = ARGV[4]

local raw = redis.call('GET', sessionKey)
if not raw then
  return 0
end

local session = cjson.decode(raw)
if session.tenantId ~= tenantId then
  return 0
end

if session.status ~= 'active' and session.status ~= 'billRequested' then
  return 0
end

session.expiresAt = newExpiresAt
local updatedRaw = cjson.encode(session)
redis.call('SET', sessionKey, updatedRaw, 'EX', ttl)

local pointerKey = 'tenant:' .. tenantId .. ':table:' .. session.tableId .. ':session'
if redis.call('GET', pointerKey) == sessionId then
  redis.call('EXPIRE', pointerKey, ttl)
end

return 1
`;

export class RedisTableSessionRepository implements TableSessionRepository {
  constructor(private readonly redis: Redis) {}

  async findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null> {
    const pointerKey = RedisKeys.tableSessionPointer(tenantId, tableId);
    const sessionId = await this.redis.get(pointerKey);
    if (!sessionId) return null;

    const session = await this.findById(tenantId, sessionId);
    if (session && (session.status === 'active' || session.status === 'billRequested')) {
      return session;
    }
    return null;
  }

  async findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) return null;

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) return null;
    return session;
  }

  async save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(session.sessionId);
    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const setKey = RedisKeys.tenantSessions(tenantId);
    const payload = JSON.stringify(session);

    let rawResult: unknown;
    if (session.status === 'active' || session.status === 'billRequested') {
      const tableKey = RedisKeys.table(tenantId, session.tableId);
      try {
        rawResult = await this.redis.eval(
          LUA_SAVE_ACTIVE,
          4,
          pointerKey,
          sessionKey,
          setKey,
          tableKey,
          session.sessionId,
          payload,
          ttlSeconds,
          tenantId
        );
      } catch (err: any) {
        if (err?.message?.includes('TABLE_NOT_FOUND')) {
          throw new DomainError(
            'TABLE_NOT_FOUND',
            `TABLE_NOT_FOUND: Mesa ${session.tableId} no encontrada`
          );
        }
        if (err?.message?.includes('TABLE_INACTIVE')) {
          throw new DomainError(
            'TABLE_INACTIVE',
            `TABLE_INACTIVE: Mesa ${session.tableId} inactiva`
          );
        }
        throw err;
      }
    } else {
      rawResult = await this.redis.eval(
        LUA_SAVE_INACTIVE,
        3,
        pointerKey,
        sessionKey,
        setKey,
        session.sessionId,
        payload,
        ttlSeconds
      );
    }

    return JSON.parse(rawResult as string);
  }

  async requestBill(tenantId: string, sessionId: string): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }

    if (session.status !== 'active') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede solicitar la cuenta para una sesión en estado '${session.status}'`
      );
    }

    const currentTtl = await this.redis.ttl(sessionKey);
    const ttlSeconds = currentTtl > 0 ? currentTtl : 14400;

    session.status = 'billRequested';
    session.billRequestedAt = new Date().toISOString();

    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const payload = JSON.stringify(session);

    await this.redis
      .multi()
      .set(sessionKey, payload, 'EX', ttlSeconds)
      .set(pointerKey, session.sessionId, 'EX', ttlSeconds)
      .exec();

    return session;
  }

  async reopenBill(tenantId: string, sessionId: string): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(sessionId);
    const raw = await this.redis.get(sessionKey);
    if (!raw) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }

    const session: TableSessionDTO = JSON.parse(raw);
    if (session.tenantId !== tenantId) {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }

    if (session.status !== 'billRequested') {
      throw new DomainError(
        'INVALID_SESSION_STATE',
        `No se puede reabrir la cuenta para una sesión en estado '${session.status}'`
      );
    }

    const currentTtl = await this.redis.ttl(sessionKey);
    const ttlSeconds = currentTtl > 0 ? currentTtl : 14400;

    session.status = 'active';
    delete session.billRequestedAt;

    const pointerKey = RedisKeys.tableSessionPointer(tenantId, session.tableId);
    const payload = JSON.stringify(session);

    await this.redis
      .multi()
      .set(sessionKey, payload, 'EX', ttlSeconds)
      .set(pointerKey, session.sessionId, 'EX', ttlSeconds)
      .exec();

    return session;
  }

  async close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(sessionId);
    try {
      const rawResult = await this.redis.eval(
        LUA_CLOSE,
        1,
        sessionKey,
        tenantId,
        sessionId,
        closedAt.toISOString(),
        86400
      );
      return JSON.parse(rawResult as string);
    } catch (err: any) {
      if (err?.message?.includes('SESSION_NOT_FOUND')) {
        throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
      }
      throw err;
    }
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'billRequested' | 'closed'; tableId?: string }
  ): Promise<TableSessionDTO[]> {
    const setKey = RedisKeys.tenantSessions(tenantId);
    const sessionIds = await this.redis.smembers(setKey);
    if (!sessionIds.length) return [];

    const keys = sessionIds.map((id) => RedisKeys.session(id));
    const rawSessions = await this.redis.mget(keys);

    const sessions: TableSessionDTO[] = [];
    for (const raw of rawSessions) {
      if (raw) {
        const parsed: TableSessionDTO = JSON.parse(raw);
        if (parsed.tenantId !== tenantId) continue;
        if (filter?.status && parsed.status !== filter.status) continue;
        if (filter?.tableId && parsed.tableId !== filter.tableId) continue;
        sessions.push(parsed);
      }
    }
    return sessions;
  }

  async moveToTable(tenantId: string, sessionId: string, targetTableId: string): Promise<TableSessionDTO> {
    const sessionKey = RedisKeys.session(sessionId);
    const targetPointerKey = RedisKeys.tableSessionPointer(tenantId, targetTableId);

    const luaScript = `
      local sessionKey = KEYS[1]
      local targetPointerKey = KEYS[2]

      local tenantId = ARGV[1]
      local targetTableId = ARGV[2]

      local raw = redis.call('GET', sessionKey)
      if not raw then
        return 'ERR_SESSION_NOT_FOUND'
      end

      local ok, session = pcall(cjson.decode, raw)
      if not ok or not session then
        return 'ERR_SESSION_NOT_FOUND'
      end

      if session.tenantId ~= tenantId then
        return 'ERR_SESSION_NOT_FOUND'
      end

      if session.status ~= 'active' and session.status ~= 'billRequested' then
        return 'ERR_INVALID_SESSION_STATE'
      end

      local oldTableId = session.tableId
      if oldTableId == targetTableId then
        return raw
      end

      local targetSessionId = redis.call('GET', targetPointerKey)
      if targetSessionId and targetSessionId ~= '' and targetSessionId ~= session.sessionId then
        local targetSessionKey = 'session:' .. targetSessionId
        local rawTarget = redis.call('GET', targetSessionKey)
        if rawTarget then
          local okTarget, targetSession = pcall(cjson.decode, rawTarget)
          if okTarget and targetSession and (targetSession.status == 'active' or targetSession.status == 'billRequested') then
            return 'ERR_TABLE_HAS_ACTIVE_SESSION'
          end
        end
      end

      local currentTtl = redis.call('TTL', sessionKey)
      local ttl = tonumber(currentTtl)
      if not ttl or ttl <= 0 then
        ttl = 3600
      end

      local oldPointerKey = 'tenant:' .. tenantId .. ':table:' .. oldTableId .. ':session'
      session.tableId = targetTableId
      local newPayload = cjson.encode(session)

      redis.call('SET', sessionKey, newPayload, 'EX', ttl)
      redis.call('DEL', oldPointerKey)
      redis.call('SET', targetPointerKey, session.sessionId, 'EX', ttl)

      return newPayload
    `;

    const result = await this.redis.eval(
      luaScript,
      2,
      sessionKey,
      targetPointerKey,
      tenantId,
      targetTableId
    );

    if (result === 'ERR_SESSION_NOT_FOUND') {
      throw new DomainError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Sesión ${sessionId} no encontrada`);
    }
    if (result === 'ERR_INVALID_SESSION_STATE') {
      throw new DomainError('INVALID_SESSION_STATE', 'No se puede cambiar de mesa una sesión que no está activa');
    }
    if (result === 'ERR_TABLE_HAS_ACTIVE_SESSION') {
      throw new DomainError('TABLE_HAS_ACTIVE_SESSION', `La mesa de destino ${targetTableId} ya tiene una sesión activa`);
    }

    return JSON.parse(result as string) as TableSessionDTO;
  }

  async touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void> {
    const sessionKey = RedisKeys.session(sessionId);
    const newExpiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await this.redis.eval(
      LUA_TOUCH,
      1,
      sessionKey,
      tenantId,
      sessionId,
      ttlSeconds,
      newExpiresAt
    );
  }

  async getOrCreateActive(
    tenantId: string,
    tableId: string,
    candidateOrTtl: TableSessionDTO | number,
    maybeTtl?: number
  ): Promise<TableSessionDTO> {
    let candidate: TableSessionDTO;
    let ttlSeconds: number;

    if (typeof candidateOrTtl === 'number') {
      ttlSeconds = candidateOrTtl;
      const now = new Date();
      candidate = {
        sessionId: `session-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        tenantId,
        tableId,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      };
    } else {
      candidate = candidateOrTtl;
      ttlSeconds = maybeTtl ?? 14400;
    }

    return this.save(tenantId, candidate, ttlSeconds);
  }

  async getOrCreate(
    tenantId: string,
    tableId: string,
    candidateOrTtl: TableSessionDTO | number,
    maybeTtl?: number
  ): Promise<TableSessionDTO> {
    return this.getOrCreateActive(tenantId, tableId, candidateOrTtl as any, maybeTtl);
  }
}
