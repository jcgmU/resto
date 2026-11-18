import { ServiceCallDTO, ServiceCallType } from '@packages/shared-types';

export function createServiceCallEntity(params: {
  callId: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  type?: ServiceCallType;
  note?: string;
  createdAt?: string;
}): ServiceCallDTO {
  return {
    callId: params.callId,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    tableId: params.tableId,
    type: params.type || 'GENERIC',
    note: params.note,
    status: 'pending',
    createdAt: params.createdAt || new Date().toISOString(),
  };
}

export function resolveServiceCallEntity(
  call: ServiceCallDTO,
  resolvedAt: Date = new Date()
): { call: ServiceCallDTO; changed: boolean } {
  if (call.status === 'resolved') {
    return { call, changed: false };
  }
  return {
    call: {
      ...call,
      status: 'resolved',
      resolvedAt: resolvedAt.toISOString(),
    },
    changed: true,
  };
}
