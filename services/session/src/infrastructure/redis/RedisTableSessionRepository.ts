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

if tableObj.status ~= 'active' then
  return redis.error_reply('TABLE_INACTIVE')
end

local existingSessionId = redis.call('GET', pointerKey)
if existingSessionId then
  local existingSessionKey = 'session:' .. existingSessionId
  local existingRaw = redis.call('GET', existingSessionKey)
  if existingRaw then
    local existing = cjson.decode(existingRaw)
    if existing.status == 'active' and existing.tenantId == tenantId then
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

if session.status ~= 'active' then
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
    if (session && session.status === 'active') {
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
    if (session.status === 'active') {
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
        throw new Error('SESSION_NOT_FOUND');
      }
      throw err;
    }
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: 'active' | 'closed'; tableId?: string }
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
}
