import { TableStatusChangedEvent } from '@packages/shared-types';

export type SessionEvent = TableStatusChangedEvent;

export interface SessionEventPublisherPort {
  publishSessionEvent(tenantId: string, event: SessionEvent): Promise<void>;
}
