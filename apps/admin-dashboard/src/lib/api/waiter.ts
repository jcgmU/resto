import { ApiClient } from '../api';
import {
  TableDTO,
  TableSessionDTO,
  ZoneDTO,
  TenantSettingsDTO,
} from '@packages/shared-types';

export interface WaiterCategory {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface WaiterProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  prepTimeMinutes?: number;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface WaiterMenuData {
  categories: WaiterCategory[];
  products: WaiterProduct[];
}

export interface WaiterCartItemInput {
  productId: string;
  quantity: number;
  notes?: string;
  productName?: string;
  unitPrice?: number;
  modifiers?: any[];
  addedBy?: string;
}

export interface ConfirmWaiterOrderInput {
  tableId?: string;
  notes?: string;
  estimatedMinutes?: number;
}

export async function fetchTables(): Promise<TableDTO[]> {
  const res = await ApiClient.request('/v1/tables');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tables)) return payload.tables;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchZones(): Promise<ZoneDTO[]> {
  const res = await ApiClient.request('/v1/zones');
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.zones)) return payload.zones;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function staffOpenSession(tableId: string): Promise<{ session: TableSessionDTO }> {
  const res = await ApiClient.request('/v1/sessions/staff-open', {
    method: 'POST',
    body: JSON.stringify({ tableId }),
  });
  return res?.data ?? res;
}

export const staffOpenTableSession = staffOpenSession;

export async function fetchMenu(): Promise<WaiterMenuData> {
  const res = await ApiClient.request('/v1/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query WaiterMenu {
          categories {
            id
            name
            sortOrder
          }
          products {
            id
            name
            description
            price
            imageUrl
            isAvailable
            prepTimeMinutes
            category {
              id
              name
            }
          }
        }
      `,
    }),
  });

  if (res?.data?.errors && res.data.errors.length > 0) {
    throw new Error(res.data.errors[0].message || 'Error en consulta GraphQL');
  }

  const payload = res?.data?.data || res?.data || res;
  const categories: WaiterCategory[] = payload?.categories || [];
  const rawProducts: any[] = payload?.products || [];
  const products: WaiterProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price) || 0,
    imageUrl: p.imageUrl,
    isAvailable: p.isAvailable !== false,
    prepTimeMinutes: p.prepTimeMinutes,
    categoryId: p.categoryId ?? p.category?.id,
    category: p.category,
  }));

  return { categories, products };
}

export function getAuthenticatedStaffUser(): string {
  // 1. Check localStorage for stored user object
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem('resto_user') || window.localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.displayName && typeof u.displayName === 'string' && u.displayName.trim()) {
          return u.displayName.trim();
        }
        if (u?.name && typeof u.name === 'string' && u.name.trim()) {
          return u.name.trim();
        }
        if (u?.email && typeof u.email === 'string' && u.email.trim()) {
          return u.email.trim();
        }
      }
    } catch {}
  }

  // 2. Check JWT token from ApiClient or localStorage
  const token =
    ApiClient.token ||
    (typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('resto_access_token') || window.localStorage.getItem('token')
      : null);

  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        let decoded = '';
        if (typeof atob === 'function') {
          decoded = atob(base64);
        } else if (typeof Buffer !== 'undefined') {
          decoded = Buffer.from(base64, 'base64').toString('utf-8');
        }
        if (decoded) {
          const claims = JSON.parse(decoded);
          if (claims?.displayName && typeof claims.displayName === 'string' && claims.displayName.trim()) {
            return claims.displayName.trim();
          }
          if (claims?.name && typeof claims.name === 'string' && claims.name.trim()) {
            return claims.name.trim();
          }
          if (claims?.email && typeof claims.email === 'string' && claims.email.trim()) {
            return claims.email.trim();
          }
          if (claims?.sub && typeof claims.sub === 'string' && claims.sub.trim()) {
            return claims.sub.trim();
          }
        }
      } else if (!token.includes('.')) {
        return token;
      }
    } catch {}
  }

  // 3. Fallback
  return 'Personal de Sala';
}

export async function addWaiterCartItem(
  sessionId: string,
  item: WaiterCartItemInput
): Promise<any> {
  const effectiveAddedBy = item.addedBy?.trim() || getAuthenticatedStaffUser();
  const res = await ApiClient.request('/v1/cart/items', {
    method: 'POST',
    headers: {
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      sessionId,
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes?.trim() ? item.notes.trim() : undefined,
      addedBy: effectiveAddedBy,
      display: {
        productName: item.productName || 'Producto',
        unitPrice: item.unitPrice || 0,
        modifierNames: [],
      },
      modifiers: item.modifiers || [],
    }),
  });
  return res?.data ?? res;
}

export async function confirmWaiterOrder(
  sessionId: string,
  data: ConfirmWaiterOrderInput
): Promise<any> {
  const res = await ApiClient.request('/v1/cart/confirm', {
    method: 'POST',
    headers: {
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      sessionId,
      tableId: data.tableId,
      notes: data.notes?.trim() ? data.notes.trim() : undefined,
      estimatedMinutes: data.estimatedMinutes,
    }),
  });
  return res?.data ?? res;
}

export async function fetchTenantSettings(): Promise<TenantSettingsDTO> {
  const res = await ApiClient.request('/v1/tenant/settings');
  const payload = res?.data ?? res;
  return payload as TenantSettingsDTO;
}
