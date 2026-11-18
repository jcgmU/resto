import { SessionServicePort, TableSessionDTO } from '@packages/shared-types';
import { SessionNotOrderableError, TableMismatchError } from '../domain/errors';

/**
 * Deriva el tableId efectivo a partir de la sesión y el tableId provisto por el cliente,
 * validando que no haya discrepancia (TABLE_MISMATCH).
 */
export function deriveEffectiveTableId(
  sessionTableId?: string,
  inputTableId?: string
): string {
  if (
    inputTableId &&
    sessionTableId &&
    sessionTableId !== '*' &&
    inputTableId !== sessionTableId
  ) {
    throw new TableMismatchError('La mesa indicada no coincide con la mesa de la sesión');
  }

  return sessionTableId && sessionTableId !== '*'
    ? sessionTableId
    : inputTableId || 'default-table';
}

export interface CheckoutSessionGuardResult {
  session: TableSessionDTO | null;
  effectiveTableId: string;
}

/**
 * Guarda de sesión para ConfirmCheckout:
 * - Valida estados: active y billRequested son válidos para cobro.
 * - closed solo es válido si existe pago previo (hasExistingPayment = true).
 * - Si no existe pago previo y está closed (o cualquier otro estado inválido) -> lanza SessionNotOrderableError (409).
 * - Deriva effectiveTableId y lanza TableMismatchError (409) si hay discrepancia.
 */
export async function guardCheckoutSession(params: {
  sessionService?: SessionServicePort;
  tenantId: string;
  sessionId: string;
  inputTableId?: string;
  hasExistingPayment?: boolean;
}): Promise<CheckoutSessionGuardResult> {
  const {
    sessionService,
    tenantId,
    sessionId,
    inputTableId,
    hasExistingPayment = false,
  } = params;

  if (!sessionService) {
    return {
      session: null,
      effectiveTableId: inputTableId || 'default-table',
    };
  }

  const session = await sessionService.getSession(tenantId, sessionId);
  if (!session) {
    throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
  }

  if (session.status === 'closed') {
    if (!hasExistingPayment) {
      throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
    }
  } else if (session.status !== 'active' && session.status !== 'billRequested') {
    throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
  }

  const effectiveTableId = deriveEffectiveTableId(session.tableId, inputTableId);

  return { session, effectiveTableId };
}
