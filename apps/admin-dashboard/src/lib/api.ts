const ACCESS_TOKEN_KEY = 'resto_access_token';
const REFRESH_TOKEN_KEY = 'resto_refresh_token';

function getStoredToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
}

function getStoredRefreshToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let decoded: string;
    if (typeof atob === 'function') {
      decoded = atob(base64);
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
    } else {
      return false;
    }
    const payload = JSON.parse(decoded);
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000 <= Date.now();
    }
    return false;
  } catch {
    return false;
  }
}

export class ApiClient {
  private static _token: string | null = getStoredToken();
  private static _refreshToken: string | null = getStoredRefreshToken();
  private static _refreshPromise: Promise<string | null> | null = null;

  static get token(): string | null {
    if (this._token === null && typeof window !== 'undefined' && window.localStorage) {
      this._token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return this._token;
  }

  static set token(val: string | null) {
    this._token = val;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (val) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, val);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }
  }

  static get refreshToken(): string | null {
    if (this._refreshToken === null && typeof window !== 'undefined' && window.localStorage) {
      this._refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return this._refreshToken;
  }

  static set refreshToken(val: string | null) {
    this._refreshToken = val;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (val) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, val);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  }

  static async getValidAccessToken(forceRefresh = false): Promise<string | null> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    if (!forceRefresh && this.token && !isJwtExpired(this.token)) {
      return this.token;
    }

    const currentRefreshToken = this.refreshToken;
    if (!currentRefreshToken) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';

    this._refreshPromise = (async () => {
      try {
        const refreshRes = await fetch(`${baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });

        if (refreshRes.status === 200) {
          const data = await refreshRes.json();
          const accessToken = data?.accessToken || data?.tokens?.accessToken;
          const refreshToken = data?.refreshToken ?? data?.tokens?.refreshToken;
          if (accessToken) {
            ApiClient.token = accessToken;
            if (refreshToken) {
              ApiClient.refreshToken = refreshToken;
            }
            return accessToken;
          }
        }
        return null;
      } catch {
        return null;
      } finally {
        ApiClient._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  static async request(url: string, options: any = {}): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const token = ApiClient.token;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const res = await fetch(fullUrl, { ...options, headers });
      
      if (
        res.status === 401 &&
        !options._retried &&
        url !== '/v1/auth/refresh' &&
        ApiClient.refreshToken
      ) {
        const tokenNeedsRefresh = !ApiClient.token || ApiClient.token === token;
        const newToken = await ApiClient.getValidAccessToken(tokenNeedsRefresh);

        if (newToken) {
          return ApiClient.request(url, { ...options, _retried: true });
        }

        ApiClient.clearAuth();
        if (typeof window !== 'undefined' && window.location) {
          try {
            window.location.href = '/login';
          } catch {
            // fallback en entornos donde location.href es de sólo lectura
          }
        }
        const sessionExpiredError: any = new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        sessionExpiredError.status = 401;
        sessionExpiredError.code = 'SESSION_EXPIRED';
        throw sessionExpiredError;
      }

      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      
      if (!res.ok) {
        const nestedError = data && typeof data === 'object' && 'error' in data ? data.error : null;
        const errObj = nestedError && typeof nestedError === 'object' ? nestedError : (typeof data === 'object' ? data : null);
        
        const message =
          errObj?.message ||
          (typeof nestedError === 'string' ? nestedError : null) ||
          data?.message ||
          (typeof data === 'string' ? data : null) ||
          'Error en la petición';

        const code =
          errObj?.code ||
          data?.code ||
          (typeof nestedError === 'string' ? nestedError : null) ||
          'UNKNOWN';

        const error: any = new Error(message);
        error.status = res.status;
        error.code = code;
        error.data = data;
        throw error;
      }
      
      return { status: res.status, data };
    } catch (err: any) {
      if (err.status) throw err;
      const networkError: any = new Error(err?.message || 'Error de red');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
  }

  static async login(credentials: any): Promise<any> {
    const response = await this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (response.status === 200 && response.data?.tokens?.accessToken) {
      this.token = response.data.tokens.accessToken;
      this.refreshToken = response.data.tokens.refreshToken ?? null;
    }
    return response;
  }

  static async register(data: any): Promise<any> {
    const response = await this.request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.status === 201) {
      if (response.data?.tokens?.accessToken) {
        this.token = response.data.tokens.accessToken;
      }
      if (response.data?.tokens?.refreshToken) {
        this.refreshToken = response.data.tokens.refreshToken;
      }
    }
    return response;
  }

  static clearAuth(): void {
    this.token = null;
    this.refreshToken = null;
    this._refreshPromise = null;
  }
}

export const getValidAccessToken = (forceRefresh = false) => ApiClient.getValidAccessToken(forceRefresh);
