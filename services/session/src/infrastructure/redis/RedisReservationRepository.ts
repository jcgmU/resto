import Redis from 'ioredis';
import { ReservationRepository, ReservationDTO, ReservationStatus } from '@packages/shared-types';
import { RedisKeys } from './keys';

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

    const multi = this.redis.multi();
    multi.hset(key, fields);
    multi.sadd(tenantSet, reservation.id);
    multi.sadd(tableSet, reservation.id);
    await multi.exec();

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
