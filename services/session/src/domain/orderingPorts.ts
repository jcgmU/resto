import { ServiceCallDTO } from '@packages/shared-types';

export interface OrderingServiceCallPort {
  createServiceCall(params: {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    type: 'WAITER_CALL' | 'BILL_REQUEST' | 'GENERIC';
    note?: string;
  }): Promise<ServiceCallDTO>;
}
