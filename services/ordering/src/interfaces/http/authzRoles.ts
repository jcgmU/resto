/**
 * Única fuente de verdad de roles de autorización para ordering,
 * alineada 1:1 con routeTable.ts del gateway.
 */

export const CHECKOUT_ROLES = ['admin', 'manager', 'waiter', 'cashier'] as const;

export const CHECKOUT_OVERRIDE_PENDING_ROLES = ['admin', 'manager'] as const;

export const ORDER_STATUS_ROLES = ['admin', 'manager', 'waiter', 'monitor'] as const;

export const ORDER_CANCEL_ROLES = ['admin', 'manager'] as const;

export const ORDER_STAFF_ROLES = ['admin', 'manager', 'waiter', 'monitor', 'cashier'] as const;

export const SERVICE_CALL_ROLES = ['admin', 'manager', 'waiter', 'monitor', 'cashier'] as const;

export const ORDER_HISTORY_ROLES = ['admin', 'manager', 'waiter', 'monitor'] as const;

export const CART_STAFF_ROLES = ['admin', 'manager', 'waiter'] as const;

export const REALTIME_STAFF_ROLES = ['admin', 'manager', 'waiter', 'monitor', 'cashier'] as const;

export function hasRole(role: string | undefined | null, allowedRoles: readonly string[]): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return allowedRoles.includes(normalized);
}
