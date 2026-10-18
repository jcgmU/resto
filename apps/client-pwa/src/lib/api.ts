import { ProductDTO, CategoryDTO, CartDTO } from '@packages/shared-types';

export interface OpenSessionParams {
  tenantId: string;
  tableId: string;
  qrKey: string;
}

export interface OpenSessionResult {
  session: {
    sessionId: string;
    tenantId: string;
    tableId: string;
    status: string;
  };
  guestToken: string;
}

export interface MenuResult {
  authorized: boolean;
  categories: CategoryDTO[];
  products: ProductDTO[];
}

const GUEST_TOKEN_KEY = 'resto_guest_token';
const GUEST_SESSION_KEY = 'resto_guest_session';

function getStoredGuestToken(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage.getItem(GUEST_TOKEN_KEY);
  }
  return null;
}

function getStoredSession(): any | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const raw = window.sessionStorage.getItem(GUEST_SESSION_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export class PwaApiClient {
  private static _guestToken: string | null = getStoredGuestToken();
  private static _session: any | null = getStoredSession();

  private static authListeners = new Set<(hasToken: boolean) => void>();

  static subscribeAuth(listener: (hasToken: boolean) => void): () => void {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  static notifyAuthChange(): void {
    const hasToken = Boolean(this.guestToken);
    this.authListeners.forEach((listener) => {
      try {
        listener(hasToken);
      } catch {
        // ignore listener errors
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resto:guest-auth-change', { detail: { hasToken } }));
    }
  }

  static get guestToken(): string | null {
    if (this._guestToken === null && typeof window !== 'undefined' && window.sessionStorage) {
      this._guestToken = window.sessionStorage.getItem(GUEST_TOKEN_KEY);
    }
    return this._guestToken;
  }

  static set guestToken(val: string | null) {
    this._guestToken = val;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (val) {
        window.sessionStorage.setItem(GUEST_TOKEN_KEY, val);
      } else {
        window.sessionStorage.removeItem(GUEST_TOKEN_KEY);
      }
    }
    this.notifyAuthChange();
  }

  static get session(): any | null {
    if (this._session === null && typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(GUEST_SESSION_KEY);
      if (raw) {
        try {
          this._session = JSON.parse(raw);
        } catch {
          this._session = null;
        }
      }
    }
    return this._session;
  }

  static set session(val: any | null) {
    this._session = val;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (val) {
        window.sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(val));
      } else {
        window.sessionStorage.removeItem(GUEST_SESSION_KEY);
      }
    }
  }

  static clearAuth(): void {
    this.guestToken = null;
    this.session = null;
    this.notifyAuthChange();
  }

  static checkAuthExpired(res: { status: number }): void {
    if (res.status === 401) {
      PwaApiClient.guestToken = null;
      PwaApiClient.session = null;
      PwaApiClient.notifyAuthChange();
      const err: any = new Error('Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  }

  static async openSession(params: OpenSessionParams): Promise<OpenSessionResult> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/sessions/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Error abriendo sesión');
      (err as any).code = data.code || 'UNKNOWN';
      throw err;
    }

    PwaApiClient.guestToken = data.guestToken;
    PwaApiClient.session = data.session;

    return data;
  }

  static async fetchMenu(tenantId: string): Promise<MenuResult> {
    const isAuthorized = Boolean(PwaApiClient.guestToken);
    
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isAuthorized ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        query: `
          query GetMenu {
            categories { id name sortOrder isActive }
            products {
              id
              name
              price
              isAvailable
              imageUrl
              sortOrder
              category { id }
              modifierGroups {
                id
                name
                minSelections
                maxSelections
                isRequired
                options {
                  id
                  name
                  priceDelta
                  isDefault
                }
              }
            }
          }
        `,
      })
    });

    PwaApiClient.checkAuthExpired(res);

    const data = await res.json();

    const categories = (data?.data?.categories || []).map((c: any) => ({ ...c, tenantId }));
    const products = (data?.data?.products || []).map((p: any) => ({
      ...p,
      categoryId: p.categoryId ?? p.category?.id,
      tenantId,
      modifierGroups: (p.modifierGroups || []).map((mg: any) => ({
        ...mg,
        tenantId: mg.tenantId || tenantId,
        minSelections: mg.minSelections ?? 0,
        maxSelections: mg.maxSelections ?? 0,
        isRequired: Boolean(mg.isRequired),
        options: Array.isArray(mg.options)
          ? mg.options.map((opt: any) => ({
              ...opt,
              groupId: opt.groupId || mg.id,
              isDefault: Boolean(opt.isDefault),
              priceDelta: Number(opt.priceDelta || 0),
            }))
          : [],
      })),
    }));

    return {
      authorized: isAuthorized,
      categories,
      products,
    };
  }

  static async getCart(): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart`, {
      headers: {
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const err = new Error(await res.text());
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async addToCart(params: {
    productId: string;
    quantity: number;
    modifiers?: any[];
    notes?: string;
    display?: {
      productName: string;
      unitPrice: number;
      modifierNames: string[];
    };
  }): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({
        productId: params.productId,
        quantity: params.quantity,
        modifiers: params.modifiers || [],
        notes: params.notes || '',
        addedBy: 'Cliente',
        ...(params.display ? { display: params.display } : {}),
      }),
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al agregar al carrito');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/items/${encodeURIComponent(cartItemId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({ quantity }),
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al actualizar cantidad');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async removeCartItem(cartItemId: string): Promise<CartDTO> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/items/${encodeURIComponent(cartItemId)}`, {
      method: 'DELETE',
      headers: {
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al eliminar item del carrito');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async confirmOrder(paramsOrTableId: string | { tableId?: string; notes?: string }): Promise<any> {
    const body = typeof paramsOrTableId === 'string'
      ? { tableId: paramsOrTableId }
      : { tableId: paramsOrTableId?.tableId, ...(paramsOrTableId?.notes ? { notes: paramsOrTableId.notes } : {}) };
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/cart/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error?.message || 'Error al confirmar pedido');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async requestBill(sessionIdOrTableId?: string): Promise<any> {
    const effectiveSessionId = PwaApiClient.session?.sessionId || sessionIdOrTableId;
    if (!effectiveSessionId) {
      throw new Error('No hay una sesión activa para solicitar la cuenta');
    }
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/sessions/${encodeURIComponent(effectiveSessionId)}/bill-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify({}),
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error?.message || 'Error al solicitar la cuenta');
      (err as any).status = res.status;
      (err as any).code = data.code || data.error?.code || 'UNKNOWN';
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (PwaApiClient.session) {
      PwaApiClient.session = {
        ...PwaApiClient.session,
        status: 'billRequested',
      };
    }
    return data;
  }

  static async getOrder(orderId: string): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || 'Error al obtener orden');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  static async getOrders(): Promise<any[]> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/v1/orders`, {
      method: 'GET',
      headers: {
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error?.message || 'Error al obtener órdenes');
      (err as any).status = res.status;
      (err as any).code = data.code || data.error?.code || 'UNKNOWN';
      throw err;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }

  static async getTenantSettings(): Promise<{ operatingMode?: string; [key: string]: any }> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    try {
      const res = await fetch(`${baseUrl}/v1/tenant/settings`, {
        method: 'GET',
        headers: {
          ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
        },
      });
      if (!res.ok) {
        return { operatingMode: 'hybrid' };
      }
      return await res.json().catch(() => ({ operatingMode: 'hybrid' }));
    } catch {
      return { operatingMode: 'hybrid' };
    }
  }

  static async createServiceCall(params?: { type?: string; note?: string; tableId?: string }): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const body: Record<string, any> = {
      type: params?.type || 'WAITER_CALL',
      ...(params?.note ? { note: params.note } : {}),
      ...(params?.tableId ? { tableId: params.tableId } : {}),
    };
    const res = await fetch(`${baseUrl}/v1/service-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    PwaApiClient.checkAuthExpired(res);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.message || data.error?.message || 'Error al llamar al mesero');
      (err as any).status = res.status;
      (err as any).code = data.code || data.error?.code || 'UNKNOWN';
      throw err;
    }
    return res.json().catch(() => ({}));
  }

  static async callWaiter(reason?: string): Promise<any> {
    return PwaApiClient.createServiceCall({ type: 'WAITER_CALL', note: reason });
  }

  static async request(url: string, options: any = {}): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(PwaApiClient.guestToken ? { Authorization: `Bearer ${PwaApiClient.guestToken}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(fullUrl, { ...options, headers });
    PwaApiClient.checkAuthExpired(res);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const error: any = new Error(data?.message || 'Error en la petición');
      error.status = res.status;
      error.code = data?.code || 'UNKNOWN';
      throw error;
    }
    return { status: res.status, data };
  }
}
