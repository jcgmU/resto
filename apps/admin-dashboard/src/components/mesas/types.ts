export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface TableItem {
  tableId: string;
  label: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  tenantId?: string;
}

export interface TableQrData {
  url: string;
  pngDataUrl: string;
}

export interface SessionItem {
  id?: string;
  sessionId?: string;
  tableId: string;
  status: string;
}

export interface TableStatusInfo {
  label: 'Deshabilitada' | 'Ocupada' | 'Disponible';
  tone: 'neutral' | 'error' | 'ok';
  slotStatus: 'deshabilitada' | 'ocupada' | 'libre';
}
