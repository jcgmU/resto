import {
  CreateServiceCallUseCase,
  EventPublisher,
  ListServiceCallsUseCase,
  ResolveServiceCallUseCase,
  ServiceCallDTO,
  ServiceCallRepository,
  SessionServicePort,
} from '@packages/shared-types';
import {
  ServiceCallNotFoundError,
  SessionNotOrderableError,
  TableMismatchError,
  ValidationError,
} from '../domain/errors';
import { createServiceCallEntity } from '../domain/serviceCall';
import { config } from '../config';

const VALID_SERVICE_CALL_TYPES = new Set(['WAITER_CALL', 'BILL_REQUEST', 'GENERIC']);

export class ServiceCallUseCases {
  constructor(
    private readonly serviceCallRepo: ServiceCallRepository,
    private readonly eventPublisher?: EventPublisher,
    private readonly sessionService?: SessionServicePort
  ) {}

  createServiceCall: CreateServiceCallUseCase = {
    execute: async (input) => {
      if (input.type && !VALID_SERVICE_CALL_TYPES.has(input.type)) {
        throw new ValidationError(`Tipo de llamada de servicio inválido: '${input.type}'`);
      }

      let effectiveTableId = input.tableId || '';
      if (this.sessionService) {
        const session = await this.sessionService.getSession(input.tenantId, input.sessionId);
        if (!session || session.status === 'closed') {
          throw new SessionNotOrderableError('La sesión no admite llamadas de servicio en su estado actual');
        }
        if (input.tableId && session.tableId && session.tableId !== '*' && input.tableId !== session.tableId) {
          throw new TableMismatchError('La mesa indicada no coincide con la mesa de la sesión');
        }
        effectiveTableId = (session.tableId && session.tableId !== '*') ? session.tableId : (input.tableId || 'default-table');
      }
      if (!effectiveTableId) {
        effectiveTableId = 'default-table';
      }

      const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const call: ServiceCallDTO = createServiceCallEntity({
        callId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        tableId: effectiveTableId,
        type: input.type,
        note: input.note,
        createdAt: new Date().toISOString(),
      });

      const saved = await this.serviceCallRepo.save(
        input.tenantId,
        call,
        config.serviceCallTtlSeconds
      );

      if (this.eventPublisher) {
        await this.eventPublisher.publishServiceCallEvent(input.tenantId, {
          type: 'service-call.created',
          call: saved,
          occurredAt: new Date().toISOString(),
        });
      }

      return saved;
    },
  };

  resolveServiceCall: ResolveServiceCallUseCase = {
    execute: async (input) => {
      const existing = await this.serviceCallRepo.findById(input.tenantId, input.callId);
      if (!existing) {
        throw new ServiceCallNotFoundError();
      }

      if (existing.status === 'resolved') {
        return existing;
      }

      const resolved = await this.serviceCallRepo.resolve(input.tenantId, input.callId, new Date());

      if (this.eventPublisher) {
        await this.eventPublisher.publishServiceCallEvent(input.tenantId, {
          type: 'service-call.resolved',
          call: resolved,
          occurredAt: new Date().toISOString(),
        });
      }

      return resolved;
    },
  };

  listServiceCalls: ListServiceCallsUseCase = {
    execute: async (input) => {
      return this.serviceCallRepo.listByTenant(input.tenantId, input.filter);
    },
  };
}
