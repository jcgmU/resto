import Redis from 'ioredis';
import { CartDTO, CartItemDTO, CartRepository } from '@packages/shared-types';
import {
  CartReservation,
  CartReservationPort,
} from '../../application/ports/CartReservationPort';
import { CartBusyError, ValidationError } from '../../domain/errors';

export class RedisCartRepository implements CartRepository, CartReservationPort {
  public readonly leaseTtlMs: number;

  constructor(private readonly redis: Redis, options?: { leaseTtlMs?: number }) {
    this.leaseTtlMs = options?.leaseTtlMs ?? 30000;
  }

  private getKey(tenantId: string, sessionId: string): string {
    return `cart:${tenantId}:${sessionId}`;
  }

  private getReservationKey(tenantId: string, sessionId: string): string {
    return `cart:reservation:${tenantId}:${sessionId}`;
  }

  private getLeaseKey(tenantId: string, sessionId: string, operationId: string): string {
    return `cart:reservation:lease:${tenantId}:${sessionId}:${operationId}`;
  }

  private calculateTotal(items: CartItemDTO[]): number {
    const totalCents = items.reduce((sum, item) => {
      const deltas = (item.modifiers || []).reduce(
        (dSum, m) => dSum + Math.round((m.priceDelta || 0) * 100),
        0
      );
      const unitCents = Math.round(item.unitPrice * 100);
      return sum + (unitCents + deltas) * item.quantity;
    }, 0);
    return totalCents / 100;
  }

  private normalizeItem(item: CartItemDTO): CartItemDTO {
    if (!Array.isArray(item.modifiers)) {
      item.modifiers = [];
    }
    return item;
  }

  async get(tenantId: string, sessionId: string, ttlSeconds: number): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    multi.hgetall(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();

    const rawHash = (results?.[0]?.[1] as Record<string, string>) || {};
    const items: CartItemDTO[] = Object.values(rawHash).map((val) =>
      this.normalizeItem(JSON.parse(val))
    );

    return {
      tenantId,
      sessionId,
      items,
      total: this.calculateTotal(items),
    };
  }

  async upsertItem(
    tenantId: string,
    sessionId: string,
    item: CartItemDTO,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const serialized = JSON.stringify(item);

    const multi = this.redis.multi();
    multi.hset(key, item.cartItemId, serialized);
    multi.expire(key, ttlSeconds);
    await multi.exec();

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async addItemAtomic(
    tenantId: string,
    sessionId: string,
    canonicalKey: string,
    item: CartItemDTO,
    inputQuantity: number,
    maxQuantity: number,
    ttlSeconds: number
  ): Promise<{ cart: CartDTO; mergedQuantity: number }> {
    const cartKey = this.getKey(tenantId, sessionId);
    const itemJson = JSON.stringify(item);

    const luaScript = `
      local cartKey = KEYS[1]
      local targetCanonicalKey = ARGV[1]
      local newItemJson = ARGV[2]
      local inputQty = tonumber(ARGV[3])
      local maxQty = tonumber(ARGV[4])
      local ttlSeconds = tonumber(ARGV[5])

      local function buildCanonicalKey(prodId, modifiers)
        if not modifiers or #modifiers == 0 then
          return prodId .. "::"
        end
        local refs = {}
        for _, m in ipairs(modifiers) do
          table.insert(refs, (m.groupId or "") .. ":" .. (m.optionId or ""))
        end
        table.sort(refs)
        return prodId .. "::" .. table.concat(refs, "|")
      end

      local raw = redis.call('HGETALL', cartKey)
      local matchField = nil
      local matchedItem = nil

      for i = 1, #raw, 2 do
        local field = raw[i]
        local val = raw[i+1]
        local parsed = cjson.decode(val)
        local key = buildCanonicalKey(parsed.productId, parsed.modifiers)
        if key == targetCanonicalKey then
          matchField = field
          matchedItem = parsed
          break
        end
      end

      if matchedItem then
        local newQty = (matchedItem.quantity or 0) + inputQty
        if newQty > maxQty then
          return cjson.encode({ status = 'MAX_QUANTITY_EXCEEDED', currentQuantity = matchedItem.quantity, requestedQuantity = inputQty, maxQuantity = maxQty })
        end
        matchedItem.quantity = newQty
        local deltas = 0
        if matchedItem.modifiers then
          for _, m in ipairs(matchedItem.modifiers) do
            deltas = deltas + (m.priceDelta or 0)
          end
        end
        matchedItem.lineTotal = (matchedItem.unitPrice + deltas) * newQty
        redis.call('HSET', cartKey, matchField, cjson.encode(matchedItem))
        redis.call('EXPIRE', cartKey, ttlSeconds)
        return cjson.encode({ status = 'OK', mergedQuantity = newQty })
      else
        if inputQty > maxQty then
          return cjson.encode({ status = 'MAX_QUANTITY_EXCEEDED', currentQuantity = 0, requestedQuantity = inputQty, maxQuantity = maxQty })
        end
        local newItem = cjson.decode(newItemJson)
        redis.call('HSET', cartKey, newItem.cartItemId, newItemJson)
        redis.call('EXPIRE', cartKey, ttlSeconds)
        return cjson.encode({ status = 'OK', mergedQuantity = inputQty })
      end
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      1,
      cartKey,
      canonicalKey,
      itemJson,
      inputQuantity,
      maxQuantity,
      ttlSeconds
    )) as string;

    const result = JSON.parse(rawResult);

    if (result.status === 'MAX_QUANTITY_EXCEEDED') {
      const accumulated = result.currentQuantity + result.requestedQuantity;
      throw new ValidationError(
        `La cantidad acumulada (${accumulated}) supera el límite máximo permitido de ${maxQuantity} unidades`
      );
    }

    const cart = await this.get(tenantId, sessionId, ttlSeconds);
    return { cart, mergedQuantity: result.mergedQuantity };
  }

  async reserveCart(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    ttlSeconds: number
  ): Promise<{
    status: 'RESERVED' | 'EXISTING_RESERVATION' | 'EMPTY';
    reservation?: CartReservation;
  }> {
    const cartKey = this.getKey(tenantId, sessionId);
    const resKey = this.getReservationKey(tenantId, sessionId);
    const leaseKey = this.getLeaseKey(tenantId, sessionId, operationId);
    const createdAt = new Date().toISOString();

    const luaScript = `
      local cartKey = KEYS[1]
      local resKey = KEYS[2]
      local leaseKey = KEYS[3]
      local operationId = ARGV[1]
      local orderId = ARGV[2]
      local createdAt = ARGV[3]
      local ttlSeconds = tonumber(ARGV[4])
      local tenantId = ARGV[5]
      local sessionId = ARGV[6]
      local leaseTtlMs = tonumber(ARGV[7])

      if redis.call('EXISTS', resKey) == 1 then
        local existing = redis.call('GET', resKey)
        return cjson.encode({ status = 'EXISTING_RESERVATION', reservationJson = existing })
      end

      local raw = redis.call('HGETALL', cartKey)
      if #raw == 0 then
        return cjson.encode({ status = 'EMPTY' })
      end

      local items = {}
      for i = 1, #raw, 2 do
        local val = raw[i+1]
        table.insert(items, cjson.decode(val))
      end

      local reservation = {
        operationId = operationId,
        orderId = orderId,
        tenantId = tenantId,
        sessionId = sessionId,
        items = items,
        createdAt = createdAt
      }

      local resJson = cjson.encode(reservation)
      redis.call('SET', resKey, resJson, 'EX', ttlSeconds)
      redis.call('SET', leaseKey, '1', 'PX', leaseTtlMs)
      redis.call('DEL', cartKey)

      return cjson.encode({ status = 'RESERVED', reservation = reservation })
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      3,
      cartKey,
      resKey,
      leaseKey,
      operationId,
      orderId,
      createdAt,
      ttlSeconds,
      tenantId,
      sessionId,
      this.leaseTtlMs
    )) as string;

    const result = JSON.parse(rawResult);

    if (result.status === 'RESERVED') {
      const res = result.reservation as CartReservation;
      res.items = (res.items || []).map((i) => this.normalizeItem(i));
      return { status: 'RESERVED', reservation: res };
    }

    if (result.status === 'EXISTING_RESERVATION') {
      return { status: 'EXISTING_RESERVATION' };
    }

    return { status: 'EMPTY' };
  }

  async isReservationLeaseActive(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean> {
    const leaseKey = this.getLeaseKey(tenantId, sessionId, operationId);
    const exists = await this.redis.exists(leaseKey);
    return exists === 1;
  }

  async refreshReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean> {
    const leaseKey = this.getLeaseKey(tenantId, sessionId, operationId);
    const luaScript = `
      local leaseKey = KEYS[1]
      local leaseTtlMs = tonumber(ARGV[1])
      if redis.call('EXISTS', leaseKey) == 1 then
        redis.call('PEXPIRE', leaseKey, leaseTtlMs)
        return 1
      else
        return 0
      end
    `;
    const res = await this.redis.eval(luaScript, 1, leaseKey, this.leaseTtlMs);
    return res === 1;
  }

  async releaseReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<void> {
    const leaseKey = this.getLeaseKey(tenantId, sessionId, operationId);
    await this.redis.del(leaseKey);
  }

  async findReservation(tenantId: string, sessionId: string): Promise<CartReservation | null> {
    const resKey = this.getReservationKey(tenantId, sessionId);
    const raw = await this.redis.get(resKey);
    if (!raw) return null;
    const res: CartReservation = JSON.parse(raw);
    if (res && res.items) {
      res.items = res.items.map((i) => this.normalizeItem(i));
    }
    return res;
  }

  async ackReservation(tenantId: string, sessionId: string, operationId?: string): Promise<void> {
    const resKey = this.getReservationKey(tenantId, sessionId);
    const leasePrefix = `cart:reservation:lease:${tenantId}:${sessionId}:`;
    const luaScript = `
      local resKey = KEYS[1]
      local operationId = ARGV[1]
      local leasePrefix = ARGV[2]

      local current = redis.call('GET', resKey)
      if not current then
        if operationId and operationId ~= '' then
          redis.call('DEL', leasePrefix .. operationId)
        end
        return 'OK'
      end

      local res = cjson.decode(current)
      local opId = res.operationId
      if not operationId or operationId == '' or opId == operationId then
        redis.call('DEL', resKey)
        if opId and opId ~= '' then
          redis.call('DEL', leasePrefix .. opId)
        end
        if operationId and operationId ~= '' and operationId ~= opId then
          redis.call('DEL', leasePrefix .. operationId)
        end
      end
      return 'OK'
    `;

    await this.redis.eval(luaScript, 1, resKey, operationId || '', leasePrefix);
  }

  async restoreReservation(
    tenantId: string,
    sessionId: string,
    operationId: string,
    ttlSeconds: number,
    options?: { requireExpiredLease?: boolean }
  ): Promise<{
    status: 'RESTORED' | 'NOT_FOUND' | 'CONFLICT' | 'ACTIVE';
    maxExceededQty?: number;
  }> {
    const resKey = this.getReservationKey(tenantId, sessionId);
    const cartKey = this.getKey(tenantId, sessionId);
    const leaseKey = this.getLeaseKey(tenantId, sessionId, operationId);
    const requireExpiredLease = options?.requireExpiredLease ? 1 : 0;

    const luaScript = `
      local resKey = KEYS[1]
      local cartKey = KEYS[2]
      local leaseKey = KEYS[3]
      local operationId = ARGV[1]
      local ttlSeconds = tonumber(ARGV[2])
      local requireExpiredLease = tonumber(ARGV[3]) == 1

      if requireExpiredLease and redis.call('EXISTS', leaseKey) == 1 then
        return cjson.encode({ status = 'ACTIVE' })
      end

      local rawRes = redis.call('GET', resKey)
      if not rawRes then
        return cjson.encode({ status = 'NOT_FOUND' })
      end

      local res = cjson.decode(rawRes)
      if operationId and operationId ~= '' and res.operationId ~= operationId then
        return cjson.encode({ status = 'NOT_FOUND' })
      end

      local function buildCanonicalKey(prodId, modifiers)
        if not modifiers or #modifiers == 0 then
          return prodId .. "::"
        end
        local refs = {}
        for _, m in ipairs(modifiers) do
          table.insert(refs, (m.groupId or "") .. ":" .. (m.optionId or ""))
        end
        table.sort(refs)
        return prodId .. "::" .. table.concat(refs, "|")
      end

      local rawLive = redis.call('HGETALL', cartKey)
      local liveItems = {}

      for i = 1, #rawLive, 2 do
        local field = rawLive[i]
        local val = rawLive[i+1]
        local parsed = cjson.decode(val)
        table.insert(liveItems, { field = field, item = parsed })
      end

      -- Pass 1: verify no line exceeds 99
      for _, rItem in ipairs(res.items or {}) do
        local rCanon = buildCanonicalKey(rItem.productId, rItem.modifiers)
        for _, live in ipairs(liveItems) do
          local lCanon = buildCanonicalKey(live.item.productId, live.item.modifiers)
          if live.field == rItem.cartItemId or lCanon == rCanon then
            local totalQty = (live.item.quantity or 0) + (rItem.quantity or 0)
            if totalQty > 99 then
              return cjson.encode({ status = 'CONFLICT', maxExceededQty = totalQty })
            end
          end
        end
      end

      -- Pass 2: merge or restore
      for _, rItem in ipairs(res.items or {}) do
        local rCanon = buildCanonicalKey(rItem.productId, rItem.modifiers)
        local matched = false
        for _, live in ipairs(liveItems) do
          local lCanon = buildCanonicalKey(live.item.productId, live.item.modifiers)
          if live.field == rItem.cartItemId or lCanon == rCanon then
            matched = true
            local newQty = (live.item.quantity or 0) + (rItem.quantity or 0)
            live.item.quantity = newQty
            local deltas = 0
            if live.item.modifiers then
              for _, m in ipairs(live.item.modifiers) do
                deltas = deltas + (m.priceDelta or 0)
              end
            end
            live.item.lineTotal = (live.item.unitPrice + deltas) * newQty
            redis.call('HSET', cartKey, live.field, cjson.encode(live.item))
            break
          end
        end
        if not matched then
          redis.call('HSET', cartKey, rItem.cartItemId, cjson.encode(rItem))
        end
      end

      redis.call('EXPIRE', cartKey, ttlSeconds)
      redis.call('DEL', resKey)
      redis.call('DEL', leaseKey)

      return cjson.encode({ status = 'RESTORED' })
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      3,
      resKey,
      cartKey,
      leaseKey,
      operationId,
      ttlSeconds,
      requireExpiredLease
    )) as string;

    return JSON.parse(rawResult);
  }

  async setQuantity(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    quantity: number,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const res = await this.findReservation(tenantId, sessionId);
    if (res && (res.items || []).some((i) => i.cartItemId === cartItemId)) {
      throw new CartBusyError();
    }

    const key = this.getKey(tenantId, sessionId);

    if (quantity <= 0) {
      return this.removeItem(tenantId, sessionId, cartItemId, ttlSeconds);
    }

    const raw = await this.redis.hget(key, cartItemId);
    if (raw) {
      const item: CartItemDTO = this.normalizeItem(JSON.parse(raw));
      item.quantity = quantity;
      const deltas = (item.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
      item.lineTotal = (item.unitPrice + deltas) * quantity;

      const multi = this.redis.multi();
      multi.hset(key, cartItemId, JSON.stringify(item));
      multi.expire(key, ttlSeconds);
      await multi.exec();
    }

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async removeItem(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const res = await this.findReservation(tenantId, sessionId);
    if (res && (res.items || []).some((i) => i.cartItemId === cartItemId)) {
      throw new CartBusyError();
    }

    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    multi.hdel(key, cartItemId);
    multi.expire(key, ttlSeconds);
    await multi.exec();

    return this.get(tenantId, sessionId, ttlSeconds);
  }

  async clear(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getKey(tenantId, sessionId);
    await this.redis.del(key);
  }

  async clearAll(tenantId: string, sessionId: string): Promise<void> {
    const cartKey = this.getKey(tenantId, sessionId);
    const resKey = this.getReservationKey(tenantId, sessionId);
    const leasePattern = `cart:reservation:lease:${tenantId}:${sessionId}:*`;
    const leaseKeys = await this.redis.keys(leasePattern);
    const toDelete = [cartKey, resKey, ...leaseKeys];
    await this.redis.del(...toDelete);
  }

  private getCheckoutOutboxKey(tenantId: string, sessionId: string): string {
    return `checkout:outbox:${tenantId}:${sessionId}`;
  }

  private getCheckoutCompletedKey(tenantId: string, sessionId: string): string {
    return `checkout:completed:${tenantId}:${sessionId}`;
  }

  private getCheckoutConsumedKey(eventId: string): string {
    return `checkout:event:consumed:${eventId}`;
  }

  async ensureCheckoutOutboxPending(
    tenantId: string,
    sessionId: string,
    payload: any,
    ttlSeconds: number = 86400
  ): Promise<{ status: 'PENDING' | 'PUBLISHED'; payload: any }> {
    const key = this.getCheckoutOutboxKey(tenantId, sessionId);
    const now = new Date().toISOString();
    const luaScript = `
      local key = KEYS[1]
      local payloadJson = ARGV[1]
      local ttlSeconds = tonumber(ARGV[2])
      local now = ARGV[3]

      local raw = redis.call('GET', key)
      if raw then
        return raw
      end

      local doc = {
        status = 'PENDING',
        payload = cjson.decode(payloadJson),
        createdAt = now,
        updatedAt = now
      }
      local encoded = cjson.encode(doc)
      redis.call('SET', key, encoded, 'EX', ttlSeconds)
      return encoded
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      1,
      key,
      JSON.stringify(payload),
      ttlSeconds,
      now
    )) as string;

    const parsed = JSON.parse(rawResult);
    return {
      status: parsed.status,
      payload: parsed.payload,
    };
  }

  async isCheckoutEventPublished(tenantId: string, sessionId: string): Promise<boolean> {
    const outboxKey = this.getCheckoutOutboxKey(tenantId, sessionId);
    const raw = await this.redis.get(outboxKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.status === 'PUBLISHED';
      } catch {
        // Fallback
      }
    }
    const completedKey = this.getCheckoutCompletedKey(tenantId, sessionId);
    const completed = await this.redis.get(completedKey);
    return completed === '1';
  }

  async markCheckoutCompleted(
    tenantId: string,
    sessionId: string,
    ttlSeconds: number = 86400
  ): Promise<boolean> {
    const outboxKey = this.getCheckoutOutboxKey(tenantId, sessionId);
    const completedKey = this.getCheckoutCompletedKey(tenantId, sessionId);
    const now = new Date().toISOString();

    const luaScript = `
      local outboxKey = KEYS[1]
      local completedKey = KEYS[2]
      local ttlSeconds = tonumber(ARGV[1])
      local now = ARGV[2]

      local wasAlreadyCompleted = redis.call('EXISTS', completedKey)

      local raw = redis.call('GET', outboxKey)
      local payload = {}
      local createdAt = now
      if raw then
        local parsed = cjson.decode(raw)
        payload = parsed.payload or {}
        createdAt = parsed.createdAt or now
      end

      local doc = {
        status = 'PUBLISHED',
        payload = payload,
        createdAt = createdAt,
        updatedAt = now
      }
      redis.call('SET', outboxKey, cjson.encode(doc), 'EX', ttlSeconds)
      redis.call('SET', completedKey, '1', 'EX', ttlSeconds)

      if wasAlreadyCompleted == 1 then
        return 0
      else
        return 1
      end
    `;

    const res = await this.redis.eval(luaScript, 2, outboxKey, completedKey, ttlSeconds, now);
    return res === 1;
  }

  async consumeCheckoutEventOnce(
    eventId: string,
    ttlSeconds: number = 86400
  ): Promise<boolean> {
    const key = this.getCheckoutConsumedKey(eventId);
    const res = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }
}
