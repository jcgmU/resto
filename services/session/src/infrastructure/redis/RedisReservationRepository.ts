import Redis from 'ioredis';
import { ReservationRepository, ReservationDTO, ReservationStatus, DomainError } from '@packages/shared-types';
import { RedisKeys } from './keys';
import { INACTIVE_RESERVATION_STATUSES } from '../../domain/reservationRules';

const LUA_SAVE_RESERVATION = `
local reservationKey = KEYS[1]
local tenantSet = KEYS[2]
local tableSet = KEYS[3]
local tableKey = KEYS[4]
local tenantId = ARGV[1]
local reservationId = ARGV[2]
local makesInactive = ARGV[3] == '1'

if not makesInactive then
  local tableRaw = redis.call('GET', tableKey)
  if not tableRaw then
    return redis.error_reply('TABLE_NOT_FOUND')
  end
  local tableObj = cjson.decode(tableRaw)
  if tableObj.tenantId ~= tenantId or tableObj.status == 'deleted' then
    return redis.error_reply('TABLE_NOT_FOUND')
  end
end

local fields = {}
for i = 4, #ARGV do
  table.insert(fields, ARGV[i])
end
redis.call('HSET', reservationKey, unpack(fields))
redis.call('SADD', tenantSet, reservationId)
redis.call('SADD', tableSet, reservationId)
return 1
`;

export class RedisReservationRepository implements ReservationRepository {
  constructor(private readonly redis: Redis) {}

  async save(tenantId: string, reservation: ReservationDTO): Promise<ReservationDTO> {
    const key = RedisKeys.reservation(reservation.id);
    const tenantSet = RedisKeys.tenantReservations(tenantId);
    const tableSet = RedisKeys.tableReservations(reservation.tableId);

    const fields: Record<string, string> = {
      id: reservation.id,
      tenantId,
      tableId: reservation.tableId,
      customerName: reservation.customerName,
      phone: reservation.phone,
      partySize: String(reservation.partySize),
      reservedFor: reservation.reservedFor,
      status: reservation.status,
      createdAt: reservation.createdAt,
    };
    if (reservation.notes) {
      fields.notes = reservation.notes;
    }

    const flatFields = Object.entries(fields).flat();
    const makesInactive = (INACTIVE_RESERVATION_STATUSES as readonly string[]).includes(String(reservation.status).toLowerCase());
    try {
      await this.redis.eval(
        LUA_SAVE_RESERVATION,
        4,
        key,
        tenantSet,
        tableSet,
        RedisKeys.table(tenantId, reservation.tableId),
        tenantId,
        reservation.id,
        makesInactive ? '1' : '0',
        ...flatFields
      );
    } catch (err: any) {
      if (err?.message?.includes('TABLE_NOT_FOUND')) {
        throw new DomainError('TABLE_NOT_FOUND', `Mesa ${reservation.tableId} no encontrada`);
      }
      throw err;
    }

    return reservation;
  }

  async findById(tenantId: string, reservationId: string): Promise<ReservationDTO | null> {
    const key = RedisKeys.reservation(reservationId);
    const raw = await this.redis.hgetall(key);
    if (!raw || !raw.id || raw.tenantId !== tenantId) {
      return null;
    }

    return {
      id: raw.id,
      tenantId: raw.tenantId,
      tableId: raw.tableId,
      customerName: raw.customerName,
      phone: raw.phone,
      partySize: Number(raw.partySize),
      reservedFor: raw.reservedFor,
      status: raw.status as ReservationStatus,
      notes: raw.notes || undefined,
      createdAt: raw.createdAt,
    };
  }

  async listByTenant(
    tenantId: string,
    filter?: { tableId?: string; date?: string; status?: ReservationStatus }
  ): Promise<ReservationDTO[]> {
    let ids: string[];
    if (filter?.tableId) {
      ids = await this.redis.smembers(RedisKeys.tableReservations(filter.tableId));
    } else {
      ids = await this.redis.smembers(RedisKeys.tenantReservations(tenantId));
    }
    if (!ids.length) return [];

    const pipeline = this.redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(RedisKeys.reservation(id)));
    const results = await pipeline.exec();

    const reservations: ReservationDTO[] = [];
    for (const [err, raw] of results || []) {
      if (!err && raw && (raw as Record<string, string>).id && (raw as Record<string, string>).tenantId === tenantId) {
        const item = raw as Record<string, string>;
        if (filter?.status && item.status !== filter.status) continue;
        if (filter?.date && !item.reservedFor.startsWith(filter.date)) continue;
        if (filter?.tableId && item.tableId !== filter.tableId) continue;

        reservations.push({
          id: item.id,
          tenantId: item.tenantId,
          tableId: item.tableId,
          customerName: item.customerName,
          phone: item.phone,
          partySize: Number(item.partySize),
          reservedFor: item.reservedFor,
          status: item.status as ReservationStatus,
          notes: item.notes || undefined,
          createdAt: item.createdAt,
        });
      }
    }

    reservations.sort((a, b) => new Date(a.reservedFor).getTime() - new Date(b.reservedFor).getTime());
    return reservations;
  }

  async listByTable(tenantId: string, tableId: string): Promise<ReservationDTO[]> {
    return this.listByTenant(tenantId, { tableId });
  }

  async delete(tenantId: string, reservationId: string): Promise<void> {
    const raw = await this.redis.hgetall(RedisKeys.reservation(reservationId));
    if (!raw || !raw.id) return;

    await this.redis
      .multi()
      .del(RedisKeys.reservation(reservationId))
      .srem(RedisKeys.tenantReservations(tenantId), reservationId)
      .srem(RedisKeys.tableReservations(raw.tableId), reservationId)
      .exec();
  }
}
