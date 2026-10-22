import { ApiClient } from '../api';
import { BillDTO, PaymentMethod, TableSessionDTO, TableDTO, PaymentDTO } from '@packages/shared-types';

export interface CheckoutConfirmResult {
  bill?: BillDTO;
  payment?: PaymentDTO | any;
  amount: number;
}

export interface FormattedCheckoutError {
  code: string;
  message: string;
  userMessage: string;
}

export function parseCheckoutError(err: any): FormattedCheckoutError {
  const code = err?.code || err?.data?.error?.code || 'UNKNOWN';
  const rawMessage = err?.message || err?.data?.error?.message || 'Error en la petición';

  const friendlyMessages: Record<string, string> = {
    BILL_EMPTY: 'La mesa no tiene pedidos registrados para cobrar.',
    BILL_NOT_FOUND: 'No se encontraron pedidos registrados para esta sesión.',
    SESSION_NOT_FOUND: 'La sesión no existe o ya fue cerrada.',
    SESSION_CLOSE_FAILED: 'Error al cerrar la sesión en el servidor.',
    SESSION_NOT_ORDERABLE: 'La sesión ya no admite modificaciones.',
    TABLE_NOT_FOUND: 'Mesa no encontrada.',
    TABLE_MISMATCH: 'La mesa no coincide con la sesión actual.',
    FORBIDDEN: 'No tienes permisos para realizar esta operación.',
    NETWORK_ERROR: 'Error de conexión con el servidor. Verifica tu red.',
    INTERNAL_ERROR: 'Error interno del servidor.',
  };

  const userMessage = friendlyMessages[code] || rawMessage;

  return {
    code,
    message: rawMessage,
    userMessage,
  };
}

export async function fetchActiveSessions(): Promise<TableSessionDTO[]> {
  const res = await ApiClient.request('/v1/sessions');
  const payload = res?.data ?? res;
  let list: TableSessionDTO[] = [];
  if (Array.isArray(payload)) list = payload;
  else if (payload && Array.isArray(payload.sessions)) list = payload.sessions;
  else if (payload && Array.isArray(payload.data)) list = payload.data;
  return list.filter((s) => s && s.status !== 'closed');
}

export async function fetchTables(): Promise<TableDTO[]> {
  const res = await ApiClient.request('/v1/tables');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tables)) return payload.tables;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchSessionBill(sessionId: string): Promise<BillDTO> {
  const res = await ApiClient.request(`/v1/checkout/${sessionId}`);
  const payload = res?.data ?? res;
  if (payload && typeof payload === 'object' && 'bill' in payload && payload.bill) {
    return payload.bill as BillDTO;
  }
  return payload as BillDTO;
}

export async function confirmCheckout(params: {
  sessionId: string;
  tableId: string;
  method: PaymentMethod;
  amount?: number;
}): Promise<CheckoutConfirmResult> {
  const res = await ApiClient.request('/v1/checkout/confirm', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const payload = res?.data ?? res;

  if (payload && typeof payload === 'object' && ('payment' in payload || 'bill' in payload)) {
    const payment = payload.payment;
    const bill = payload.bill;
    const amount = payment?.amount ?? bill?.total ?? params.amount ?? 0;
    return {
      bill,
      payment,
      amount,
    };
  }

  const amount = payload?.amount ?? params.amount ?? 0;
  return {
    payment: payload,
    amount,
  };
}

export async function closeSession(sessionId: string): Promise<TableSessionDTO> {
  const res = await ApiClient.request(`/v1/sessions/${sessionId}/close`, {
    method: 'PATCH',
  });
  const payload = res?.data ?? res;
  if (payload && typeof payload === 'object' && 'session' in payload && payload.session) {
    return payload.session as TableSessionDTO;
  }
  return payload as TableSessionDTO;
}

export async function retryInvoice(sessionId: string): Promise<any> {
  const res = await ApiClient.request(`/v1/checkout/${sessionId}/retry-invoice`, {
    method: 'POST',
  });
  return res?.data ?? res;
}
