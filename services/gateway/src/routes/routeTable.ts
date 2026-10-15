export interface RouteDefinition {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';
  path: string;
  auth: boolean;
  requiredRoles?: string[];
  targetService: 'identity' | 'catalog' | 'session' | 'ordering';
}

export const routeTable: RouteDefinition[] = [
  // Auth (públicas)
  { method: 'POST', path: '/v1/auth/register', auth: false, targetService: 'identity' },
  { method: 'POST', path: '/v1/auth/login', auth: false, targetService: 'identity' },
  { method: 'POST', path: '/v1/auth/refresh', auth: false, targetService: 'identity' },

  // Auth & Identity (protegidas)
  { method: 'POST', path: '/v1/auth/logout', auth: true, targetService: 'identity' },
  { method: 'GET', path: '/v1/identity/me', auth: true, targetService: 'identity' },
  { method: 'POST', path: '/v1/identity/users', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { path: '/v1/identity/users/:id', auth: true, requiredRoles: ['admin'], targetService: 'identity' },

  // Tenant Settings (FASE B)
  { method: 'GET', path: '/v1/tenant/settings', auth: true, targetService: 'identity' },
  { method: 'PATCH', path: '/v1/tenant/settings', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'identity' },

  // Catalog & Uploads (FASE B)
  { path: '/v1/graphql', auth: true, targetService: 'catalog' },
  { method: 'POST', path: '/v1/uploads', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'catalog' },
  { method: 'GET', path: '/uploads/:file', auth: false, targetService: 'catalog' },
  { method: 'GET', path: '/v1/uploads/:file', auth: false, targetService: 'catalog' },

  // Zonas (FASE B)
  { method: 'GET', path: '/v1/zones', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'POST', path: '/v1/zones', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/zones/:id', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'DELETE', path: '/v1/zones/:id', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },

  // Reservas (FASE B)
  { method: 'GET', path: '/v1/reservations', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'POST', path: '/v1/reservations', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/reservations/:id/cancel', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'POST', path: '/v1/reservations/:id/seat', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },

  // Mesas & Sesiones (Oleada 2 & FASE B)
  { method: 'POST', path: '/v1/sessions/open', auth: false, targetService: 'session' },
  { method: 'POST', path: '/v1/sessions/staff-open', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'POST', path: '/v1/tables/:tableId/qr/rotate', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'GET', path: '/v1/tables/:tableId/qr', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/tables/:tableId', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'DELETE', path: '/v1/tables/:tableId', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'POST', path: '/v1/tables', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'GET', path: '/v1/tables', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/sessions/:id/close', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'POST', path: '/v1/sessions/:id/bill-request', auth: true, targetService: 'session' },
  { method: 'POST', path: '/v1/sessions/:id/bill-reopen', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },
  { method: 'GET', path: '/v1/sessions/:id', auth: true, targetService: 'session' },
  { method: 'GET', path: '/v1/sessions', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'session' },

  // Cart (Oleada 3)
  { path: '/v1/cart/items/:cartItemId', auth: true, targetService: 'ordering' },
  { path: '/v1/cart/items', auth: true, targetService: 'ordering' },
  { path: '/v1/cart/confirm', auth: true, targetService: 'ordering' },
  { path: '/v1/cart', auth: true, targetService: 'ordering' },

  // Orders (Oleada 3, 4 & FASE B)
  { method: 'GET', path: '/v1/orders/:id/history', auth: true, targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/orders/:id/delay', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/orders/:id/cancel', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/orders/:id/status', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },
  { path: '/v1/orders/:id', auth: true, targetService: 'ordering' },
  { path: '/v1/orders', auth: true, targetService: 'ordering' },

  // Service Calls (Oleada 4)
  { method: 'POST', path: '/v1/service-calls', auth: true, targetService: 'ordering' },
  { method: 'GET', path: '/v1/service-calls', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/service-calls/:id/resolve', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },

  // Checkout (Oleada 5)
  { method: 'GET', path: '/v1/checkout/:sessionId', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },
  { method: 'POST', path: '/v1/checkout/confirm', auth: true, requiredRoles: ['admin', 'manager', 'staff', 'waiter'], targetService: 'ordering' },
];
