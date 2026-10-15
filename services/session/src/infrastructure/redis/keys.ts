export const RedisKeys = {
  table: (tenantId: string, tableId: string) => `table:${tenantId}:${tableId}`,
  tenantTables: (tenantId: string) => `tenant:${tenantId}:tables`,
  session: (sessionId: string) => `session:${sessionId}`,
  tableSessionPointer: (tenantId: string, tableId: string) => `tenant:${tenantId}:table:${tableId}:session`,
  tenantSessions: (tenantId: string) => `tenant:${tenantId}:sessions`,
  zone: (zoneId: string) => `zone:${zoneId}`,
  tenantZones: (tenantId: string) => `tenant:${tenantId}:zones`,
  reservation: (reservationId: string) => `reservation:${reservationId}`,
  tenantReservations: (tenantId: string) => `tenant:${tenantId}:reservations`,
  tableReservations: (tableId: string) => `table:${tableId}:reservations`,
};
