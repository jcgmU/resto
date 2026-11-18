import { ORDER_STATUS_LABELS } from './labels';

export const ORDER_ROUTE_STATUSES = ['PLACED', 'IN_KITCHEN', 'READY', 'DELIVERED'] as const;
export type OrderRouteStatus = (typeof ORDER_ROUTE_STATUSES)[number];
export type OrderRouteStepState = 'done' | 'current' | 'pending' | 'cancelled';

export interface OrderRouteEvent {
  id?: string;
  fromStatus: string;
  toStatus: string;
  occurredAt: string;
}

export interface OrderRouteStep {
  status: OrderRouteStatus;
  label: string;
  state: OrderRouteStepState;
  at?: string;
  durationMs?: number;
}

export interface BuildOrderRouteOptions {
  createdAt?: string;
}

function toMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function routeIndex(status: string | undefined): number {
  return ORDER_ROUTE_STATUSES.indexOf(status as OrderRouteStatus);
}

export function buildOrderRoute(
  status: string,
  events: readonly OrderRouteEvent[] = [],
  options: BuildOrderRouteOptions = {},
): OrderRouteStep[] {
  const ordered = [...events].sort((a, b) => (toMs(a.occurredAt) ?? 0) - (toMs(b.occurredAt) ?? 0));
  const firstReached = new Map<string, string>();
  for (const event of ordered) {
    if (!firstReached.has(event.toStatus)) firstReached.set(event.toStatus, event.occurredAt);
  }
  if (options.createdAt) firstReached.set('PLACED', options.createdAt);

  const cancelled = status === 'CANCELLED';
  const cancelEvent = ordered.find((e) => e.toStatus === 'CANCELLED');
  const lastReached = ORDER_ROUTE_STATUSES.reduce((last, s, i) => (firstReached.has(s) ? i : last), 0);
  const cutIndex = cancelled ? (routeIndex(cancelEvent?.fromStatus) >= 0 ? routeIndex(cancelEvent?.fromStatus) : lastReached) : -1;
  const currentIndex = cancelled ? -1 : Math.max(routeIndex(status), 0);

  let previousAt: number | null = null;
  return ORDER_ROUTE_STATUSES.map((routeStatus, i) => {
    const state: OrderRouteStepState = cancelled
      ? i < cutIndex ? 'done' : i === cutIndex ? 'cancelled' : 'pending'
      : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
    const at = state === 'cancelled' && cancelEvent ? cancelEvent.occurredAt : firstReached.get(routeStatus);
    const atMs = toMs(at);
    const durationMs = atMs !== null && previousAt !== null && state !== 'cancelled' ? Math.max(0, atMs - previousAt) : undefined;
    previousAt = atMs;
    return { status: routeStatus, label: ORDER_STATUS_LABELS[routeStatus], state, ...(at ? { at } : {}), ...(durationMs !== undefined ? { durationMs } : {}) };
  });
}

export function formatRouteDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `+${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `+${Math.floor(minutes / 60)} h` : `+${Math.floor(minutes / 60)} h ${rest} min`;
}
