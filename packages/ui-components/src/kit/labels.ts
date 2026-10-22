export const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  PLACED: 'Recibido',
  IN_KITCHEN: 'En cocina',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
};

/**
 * Recorta un ID largo o con prefijo para obtener sus últimos 6 caracteres limpios.
 * Limpia prefijos comunes (order-, table-, etc.) y guiones iniciales para evitar casos como "-zc8lj".
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return '';
  const clean = id.trim();
  const withoutPrefix = clean.replace(/^(order|ord|table|tbl|sess|session)[-_]/i, '');
  const alphanumeric = withoutPrefix.replace(/[^a-zA-Z0-9]/g, '');
  if (!alphanumeric) {
    return clean.slice(-6);
  }
  return alphanumeric.length <= 6 ? alphanumeric : alphanumeric.slice(-6);
}

/**
 * Retorna el número de orden formateado como "Orden #xxxxxx", sin guiones sueltos.
 */
export function formatOrderNumber(id: string | null | undefined): string {
  if (!id) return '';
  const sId = shortId(id);
  return `Orden #${sId}`;
}

/**
 * Resuelve el nombre visible de una mesa a partir de la lista oficial devuelta por GET /v1/tables.
 * Si la mesa no está en la lista o no tiene etiqueta, usa como respaldo "Mesa · <shortId>".
 */
export function getTableDisplayName(
  tableId: string | null | undefined,
  tables?: Array<{ tableId: string; label: string }>
): string {
  if (!tableId) return '';
  if (tables && Array.isArray(tables)) {
    const found = tables.find((t) => t.tableId === tableId || (t as any).id === tableId);
    if (found && found.label) {
      return found.label;
    }
  }
  if (/^mesa\s+\d+/i.test(tableId.trim())) {
    return tableId.trim();
  }
  return `Mesa · ${shortId(tableId)}`;
}

