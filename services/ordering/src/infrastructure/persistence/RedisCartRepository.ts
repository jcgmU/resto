import Redis from 'ioredis';
import { CartDTO, CartItemDTO, CartRepository } from '@packages/shared-types';
import { canonicalModifierKey } from '../../domain/merge';
import { ValidationError } from '../../domain/errors';

export class RedisCartRepository implements CartRepository {
  constructor(private readonly redis: Redis) {}

  private getKey(tenantId: string, sessionId: string): string {
    return `cart:${tenantId}:${sessionId}`;
  }

  private normalizeItem(item: any): CartItemDTO {
    return {
      ...item,
      modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
    };
  }

  private calculateTotal(items: CartItemDTO[]): number {
    const totalCents = items.reduce((sum, item) => {
      const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      const deltas = modifiers.reduce(
        (dSum, m) => dSum + Math.round((m.priceDelta || 0) * 100),
        0
      );
      const unitCents = Math.round(item.unitPrice * 100);
      return sum + (unitCents + deltas) * item.quantity;
    }, 0);
    return totalCents / 100;
  }

  async get(tenantId: string, sessionId: string, ttlSeconds: number): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    multi.hgetall(key);
    if (ttlSeconds && ttlSeconds > 0) {
      multi.expire(key, ttlSeconds);
    }
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
    const incomingModKey = canonicalModifierKey(item.modifiers || []);

    const luaScript = `
      pcall(function() cjson.encode_empty_table_as_object(false) end)
      local key = KEYS[1]
      local newItem = cjson.decode(ARGV[1])
      local ttlSeconds = tonumber(ARGV[2])
      local incomingModKey = ARGV[3] or ""

      local function getCanonicalModKey(mods)
        if not mods or #mods == 0 then
          return ""
        end
        local refs = {}
        for _, m in ipairs(mods) do
          table.insert(refs, tostring(m.groupId) .. ":" .. tostring(m.optionId))
        end
        table.sort(refs)
        return table.concat(refs, "|")
      end

      local rawHash = redis.call('HGETALL', key)
      local matchedField = nil
      local matchedItem = nil

      for i = 1, #rawHash, 2 do
        local field = rawHash[i]
        local valStr = rawHash[i + 1]
        local existing = cjson.decode(valStr)
        if existing.productId == newItem.productId then
          local existingModKey = getCanonicalModKey(existing.modifiers)
          if existingModKey == incomingModKey then
            matchedField = field
            matchedItem = existing
            break
          end
        end
      end

      if matchedItem then
        local newQty = matchedItem.quantity + newItem.quantity
        if newQty > 99 then
          return cjson.encode({
            error = "VALIDATION_ERROR",
            message = "La cantidad total por ítem no puede exceder 99"
          })
        end
        matchedItem.quantity = newQty
        if newItem.notes and newItem.notes ~= "" then
          matchedItem.notes = newItem.notes
        end
        local deltasCents = 0
        if matchedItem.modifiers and #matchedItem.modifiers > 0 then
          for _, m in ipairs(matchedItem.modifiers) do
            deltasCents = deltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local unitCents = math.floor((tonumber(matchedItem.unitPrice) or 0) * 100 + 0.5)
        matchedItem.lineTotal = ((unitCents + deltasCents) * newQty) / 100
        redis.call('HSET', key, matchedField, cjson.encode(matchedItem))
      else
        if newItem.quantity > 99 then
          return cjson.encode({
            error = "VALIDATION_ERROR",
            message = "La cantidad total por ítem no puede exceder 99"
          })
        end
        local deltasCents = 0
        if newItem.modifiers and #newItem.modifiers > 0 then
          for _, m in ipairs(newItem.modifiers) do
            deltasCents = deltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local unitCents = math.floor((tonumber(newItem.unitPrice) or 0) * 100 + 0.5)
        newItem.lineTotal = ((unitCents + deltasCents) * newItem.quantity) / 100
        redis.call('HSET', key, newItem.cartItemId, cjson.encode(newItem))
      end

      if ttlSeconds and ttlSeconds > 0 then
        redis.call('EXPIRE', key, ttlSeconds)
      end

      local allVals = redis.call('HVALS', key)
      local items = {}
      local totalCents = 0
      for _, v in ipairs(allVals) do
        local it = cjson.decode(v)
        table.insert(items, it)
        local itemDeltasCents = 0
        if it.modifiers and #it.modifiers > 0 then
          for _, m in ipairs(it.modifiers) do
            itemDeltasCents = itemDeltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local itUnitCents = math.floor((tonumber(it.unitPrice) or 0) * 100 + 0.5)
        totalCents = totalCents + (itUnitCents + itemDeltasCents) * it.quantity
      end

      return cjson.encode({
        items = items,
        total = totalCents / 100
      })
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      1,
      key,
      JSON.stringify(item),
      ttlSeconds.toString(),
      incomingModKey
    )) as string;

    const parsed = JSON.parse(rawResult);
    if (parsed.error === 'VALIDATION_ERROR') {
      throw new ValidationError(parsed.message || 'La cantidad total por ítem no puede exceder 99');
    }

    const items: CartItemDTO[] = (parsed.items || []).map((it: any) => this.normalizeItem(it));

    return {
      tenantId,
      sessionId,
      items,
      total: parsed.total,
    };
  }

  async addItem(
    tenantId: string,
    sessionId: string,
    item: CartItemDTO,
    ttlSeconds: number
  ): Promise<CartDTO> {
    return this.upsertItem(tenantId, sessionId, item, ttlSeconds);
  }

  async setQuantity(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    quantity: number,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);

    if (quantity <= 0) {
      return this.removeItem(tenantId, sessionId, cartItemId, ttlSeconds);
    }

    if (quantity > 99) {
      throw new ValidationError('La cantidad total por ítem no puede exceder 99');
    }

    const luaScript = `
      pcall(function() cjson.encode_empty_table_as_object(false) end)
      local key = KEYS[1]
      local cartItemId = ARGV[1]
      local newQty = tonumber(ARGV[2])
      local ttlSeconds = tonumber(ARGV[3])

      local raw = redis.call('HGET', key, cartItemId)
      if raw then
        local item = cjson.decode(raw)
        item.quantity = newQty
        local deltasCents = 0
        if item.modifiers and #item.modifiers > 0 then
          for _, m in ipairs(item.modifiers) do
            deltasCents = deltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local unitCents = math.floor((tonumber(item.unitPrice) or 0) * 100 + 0.5)
        item.lineTotal = ((unitCents + deltasCents) * newQty) / 100
        redis.call('HSET', key, cartItemId, cjson.encode(item))
      end

      if ttlSeconds and ttlSeconds > 0 then
        redis.call('EXPIRE', key, ttlSeconds)
      end

      local allVals = redis.call('HVALS', key)
      local items = {}
      local totalCents = 0
      for _, v in ipairs(allVals) do
        local it = cjson.decode(v)
        table.insert(items, it)
        local itemDeltasCents = 0
        if it.modifiers and #it.modifiers > 0 then
          for _, m in ipairs(it.modifiers) do
            itemDeltasCents = itemDeltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local itUnitCents = math.floor((tonumber(it.unitPrice) or 0) * 100 + 0.5)
        totalCents = totalCents + (itUnitCents + itemDeltasCents) * it.quantity
      end

      return cjson.encode({
        items = items,
        total = totalCents / 100
      })
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      1,
      key,
      cartItemId,
      quantity.toString(),
      ttlSeconds.toString()
    )) as string;

    const parsed = JSON.parse(rawResult);
    const items: CartItemDTO[] = (parsed.items || []).map((it: any) => this.normalizeItem(it));

    return {
      tenantId,
      sessionId,
      items,
      total: parsed.total,
    };
  }

  async removeItem(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);

    const luaScript = `
      pcall(function() cjson.encode_empty_table_as_object(false) end)
      local key = KEYS[1]
      local cartItemId = ARGV[1]
      local ttlSeconds = tonumber(ARGV[2])

      redis.call('HDEL', key, cartItemId)

      if ttlSeconds and ttlSeconds > 0 then
        redis.call('EXPIRE', key, ttlSeconds)
      end

      local allVals = redis.call('HVALS', key)
      local items = {}
      local totalCents = 0
      for _, v in ipairs(allVals) do
        local it = cjson.decode(v)
        table.insert(items, it)
        local itemDeltasCents = 0
        if it.modifiers and #it.modifiers > 0 then
          for _, m in ipairs(it.modifiers) do
            itemDeltasCents = itemDeltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local itUnitCents = math.floor((tonumber(it.unitPrice) or 0) * 100 + 0.5)
        totalCents = totalCents + (itUnitCents + itemDeltasCents) * it.quantity
      end

      return cjson.encode({
        items = items,
        total = totalCents / 100
      })
    `;

    const rawResult = (await this.redis.eval(
      luaScript,
      1,
      key,
      cartItemId,
      ttlSeconds.toString()
    )) as string;

    const parsed = JSON.parse(rawResult);
    const items: CartItemDTO[] = (parsed.items || []).map((it: any) => this.normalizeItem(it));

    return {
      tenantId,
      sessionId,
      items,
      total: parsed.total,
    };
  }

  async clear(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getKey(tenantId, sessionId);
    await this.redis.del(key);
  }

  async takeSnapshot(tenantId: string, sessionId: string): Promise<CartDTO> {
    const key = this.getKey(tenantId, sessionId);
    const luaScript = `
      pcall(function() cjson.encode_empty_table_as_object(false) end)
      local key = KEYS[1]
      local rawVals = redis.call('HVALS', key)
      if #rawVals == 0 then
        return nil
      end
      redis.call('DEL', key)
      local items = {}
      local totalCents = 0
      for _, v in ipairs(rawVals) do
        local it = cjson.decode(v)
        table.insert(items, it)
        local itemDeltasCents = 0
        if it.modifiers and #it.modifiers > 0 then
          for _, m in ipairs(it.modifiers) do
            itemDeltasCents = itemDeltasCents + math.floor((tonumber(m.priceDelta) or 0) * 100 + 0.5)
          end
        end
        local itUnitCents = math.floor((tonumber(it.unitPrice) or 0) * 100 + 0.5)
        totalCents = totalCents + (itUnitCents + itemDeltasCents) * it.quantity
      end

      return cjson.encode({
        items = items,
        total = totalCents / 100
      })
    `;

    const rawResult = (await this.redis.eval(luaScript, 1, key)) as string | null;
    if (!rawResult) {
      return {
        tenantId,
        sessionId,
        items: [],
        total: 0,
      };
    }

    const parsed = JSON.parse(rawResult);
    const items: CartItemDTO[] = (parsed.items || []).map((it: any) => this.normalizeItem(it));

    return {
      tenantId,
      sessionId,
      items,
      total: parsed.total,
    };
  }

  async restoreCart(
    tenantId: string,
    sessionId: string,
    cart: CartDTO,
    ttlSeconds: number
  ): Promise<void> {
    if (!cart.items || cart.items.length === 0) return;
    const key = this.getKey(tenantId, sessionId);
    const multi = this.redis.multi();
    for (const item of cart.items) {
      multi.hset(key, item.cartItemId, JSON.stringify(item));
    }
    if (ttlSeconds && ttlSeconds > 0) {
      multi.expire(key, ttlSeconds);
    }
    await multi.exec();
  }
}
