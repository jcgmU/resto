export const RESERVATION_ACTIVE_GRACE_MS = 2 * 60 * 60 * 1000;

export const INACTIVE_RESERVATION_STATUSES = ['cancelled', 'seated'] as const;

/** Una reserva bloquea la baja de la mesa salvo cancelada/sentada o más de 2 h en el pasado. */
export function isReservationActive(
  reservation: { status?: string | null; reservedFor: string },
  nowMs: number,
): boolean {
  const status = (reservation.status || '').toLowerCase();
  if ((INACTIVE_RESERVATION_STATUSES as readonly string[]).includes(status)) return false;
  const reservedAt = new Date(reservation.reservedFor).getTime();
  if (Number.isNaN(reservedAt)) return true;
  return reservedAt >= nowMs - RESERVATION_ACTIVE_GRACE_MS;
}
