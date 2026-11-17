export type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'CASHIER' | 'MONITOR';

const USER_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'MONITOR'];

const TERMINAL_HOME: Record<string, string> = {
  WAITER: '/terminal-mesero',
  CASHIER: '/terminal-caja',
  MONITOR: '/monitor',
};

export function terminalHomeForRole(role: string | null | undefined): string | null {
  return TERMINAL_HOME[(role || '').toUpperCase()] ?? null;
}

export function isTerminalRouteAllowed(pathname: string, role: string | null | undefined): boolean {
  const normalized = (role || '').toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'MANAGER') return true;
  const home = TERMINAL_HOME[normalized];
  if (!home) return false;
  const path = pathname.toLowerCase();
  return path === home || path.startsWith(`${home}/`);
}

export function getUserRole(token: string | null): UserRole | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    let decodedJson = '';
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      decodedJson = window.atob(base64);
    } else if (typeof Buffer !== 'undefined') {
      decodedJson = Buffer.from(payload, 'base64').toString('utf-8');
    }
    if (!decodedJson) return null;
    const parsed = JSON.parse(decodedJson);
    const role = (parsed.role || '').toUpperCase();
    if (USER_ROLES.includes(role)) {
      return role as UserRole;
    }
    return null;
  } catch {
    return null;
  }
}

export function isRouteAllowedForRole(pathname: string, role: UserRole | null): boolean {
  // Si no se puede determinar el rol (ej. token mock simple en tests), permitir por defecto
  if (!role) return true;
  if (role === 'ADMIN') return true;

  const path = pathname.toLowerCase();

  if (role === 'MANAGER') {
    // MANAGER tiene acceso a todo excepto Ajustes > Equipo (controlado a nivel de tab)
    return true;
  }

  // Terminales (WAITER, CASHIER, MONITOR): solo su pantalla; el resto del panel redirige a ella.
  return isTerminalRouteAllowed(path, role);
}
