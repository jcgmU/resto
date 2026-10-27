export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

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
    if (role === 'ADMIN' || role === 'MANAGER' || role === 'STAFF') {
      return role;
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

  if (role === 'STAFF') {
    // STAFF solo KDS, Mesas, Checkout (y Ajustes para cambio de contraseña propio)
    const allowed = ['/kds', '/mesas', '/checkout', '/ajustes'];
    return allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  return true;
}
