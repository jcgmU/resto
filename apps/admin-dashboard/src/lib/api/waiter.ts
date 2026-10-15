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

export async function addWaiterCartItem(
  sessionId: string,
  item: WaiterCartItemInput
): Promise<any> {
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
      addedBy: 'Mesero',
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
