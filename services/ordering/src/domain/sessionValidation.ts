import { PaymentRepository } from '@packages/shared-types';
import { DomainError, SessionNotActiveError, SessionUnreachableError, ValidationError } from './errors';

export interface SessionInfo {
  sessionId: string;
  tenantId: string;
  tableId?: string;
  status: 'active' | 'closed';
}

export interface OrderingSessionPort {
  closeSession(
    tenantId: string,
    sessionId: string,
    requester: { userId: string; role: string }
  ): Promise<void>;
  getSession?(tenantId: string, sessionId: string): Promise<SessionInfo | null>;
}

export async function assertSessionActive(
  tenantId: string,
  sessionId: string,
  options?: {
    tableId?: string;
    sessionService?: OrderingSessionPort;
    paymentRepo?: PaymentRepository;
    tx?: any;
    strictTransport?: boolean;
  }
): Promise<void> {
  // 1. Chequeo de pago previo para la sesión (si ya se cobró, la sesión ya no está activa)
  if (options?.paymentRepo) {
    const payment = await options.paymentRepo.findBySession(tenantId, sessionId);
    if (payment) {
      throw new SessionNotActiveError('La sesión ya ha sido pagada');
    }
  }

  // 2. Chequeo de pertenencia y estado con el microservicio de sesión
  if (options?.sessionService?.getSession) {
    let session: SessionInfo | null = null;
    try {
      session = await options.sessionService.getSession(tenantId, sessionId);
    } catch (err: any) {
      if (err instanceof DomainError) throw err;
      if (options?.strictTransport) {
        throw new SessionUnreachableError(
          `Fallo al conectar con el microservicio de sesión: ${err.message}`
        );
      }
      return;
    }

    if (!session || session.status !== 'active') {
      throw new SessionNotActiveError('La sesión no está activa o no existe');
    }

    if (session.tenantId !== tenantId) {
      throw new ValidationError('El tenant de la sesión no coincide');
    }

    if (options?.tableId && session.tableId && session.tableId !== options.tableId) {
      throw new ValidationError('La mesa indicada no coincide con la mesa de la sesión');
    }
  }
}
