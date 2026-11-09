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
  { method: 'POST', path: '/v1/auth/change-password', auth: true, targetService: 'identity' },
  { method: 'GET', path: '/v1/identity/me', auth: true, targetService: 'identity' },
  { method: 'GET', path: '/v1/identity/users', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { method: 'POST', path: '/v1/identity/users', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { method: 'POST', path: '/v1/identity/users/:id/disable', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { method: 'POST', path: '/v1/identity/users/:id/enable', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { method: 'POST', path: '/v1/identity/users/:id/reset-password', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { method: 'PATCH', path: '/v1/identity/users/:id', auth: true, requiredRoles: ['admin'], targetService: 'identity' },
  { path: '/v1/identity/users/:id', auth: true, requiredRoles: ['admin'], targetService: 'identity' },

  // Catalog
  { path: '/v1/graphql', auth: true, targetService: 'catalog' },

  // Sessions (Oleada 2)
  { method: 'POST', path: '/v1/sessions/open', auth: false, targetService: 'session' },
  { method: 'POST', path: '/v1/tables/batch/delete', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'POST', path: '/v1/tables/batch', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/tables/batch', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'POST', path: '/v1/tables/:tableId/qr/rotate', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'GET', path: '/v1/tables/:tableId/qr', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/tables/:tableId', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'POST', path: '/v1/tables', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'session' },
  { method: 'GET', path: '/v1/tables', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'session' },
  { method: 'PATCH', path: '/v1/sessions/:id/close', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'session' },
  { method: 'GET', path: '/v1/sessions/:id', auth: true, targetService: 'session' },
  { method: 'GET', path: '/v1/sessions', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'session' },

  // Cart (Oleada 3)
  { path: '/v1/cart/items/:cartItemId', auth: true, targetService: 'ordering' },
  { path: '/v1/cart/items', auth: true, targetService: 'ordering' },
  { path: '/v1/cart/confirm', auth: true, targetService: 'ordering' },
  { path: '/v1/cart', auth: true, targetService: 'ordering' },

  // Orders (Oleada 3 & 4)
  { method: 'PATCH', path: '/v1/orders/:id/cancel', auth: true, requiredRoles: ['admin', 'manager'], targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/orders/:id/status', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'ordering' },
  { path: '/v1/orders/:id', auth: true, targetService: 'ordering' },
  { path: '/v1/orders', auth: true, targetService: 'ordering' },

  // Service Calls (Oleada 4)
  { method: 'POST', path: '/v1/service-calls', auth: true, targetService: 'ordering' },
  { method: 'GET', path: '/v1/service-calls', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'ordering' },
  { method: 'PATCH', path: '/v1/service-calls/:id/resolve', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'ordering' },

  // Checkout (Oleada 5)
  { method: 'GET', path: '/v1/checkout/:sessionId', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'ordering' },
  { method: 'POST', path: '/v1/checkout/confirm', auth: true, requiredRoles: ['staff', 'manager', 'admin'], targetService: 'ordering' },
];
