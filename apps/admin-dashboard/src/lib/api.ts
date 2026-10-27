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

export class ApiClient {
  private static _token: string | null = getStoredToken();
  private static _refreshToken: string | null = getStoredRefreshToken();

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
        let refreshedTokens: any = null;
        try {
          const refreshRes = await fetch(`${baseUrl}/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: ApiClient.refreshToken }),
          });
          if (refreshRes.status === 200) {
            const data = await refreshRes.json();
            const accessToken = data?.accessToken || data?.tokens?.accessToken;
            const refreshToken = data?.refreshToken ?? data?.tokens?.refreshToken;
            if (accessToken) {
              refreshedTokens = { accessToken, refreshToken };
            }
          }
        } catch {
          // Error de red en refresh
        }

        if (refreshedTokens?.accessToken) {
          ApiClient.token = refreshedTokens.accessToken;
          if (refreshedTokens.refreshToken) {
            ApiClient.refreshToken = refreshedTokens.refreshToken;
          }
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
        const error: any = new Error(data?.message || 'Error en la petición');
        error.status = res.status;
        error.code = data?.code || 'UNKNOWN';
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

  static async listTeam(): Promise<any> {
    return this.request('/v1/identity/users', {
      method: 'GET',
    });
  }

  static async createTeamMember(data: {
    email: string;
    displayName: string;
    role: 'MANAGER' | 'STAFF';
    password: string;
  }): Promise<any> {
    return this.request('/v1/identity/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateTeamMember(
    id: string,
    data: { displayName?: string; role?: 'MANAGER' | 'STAFF' }
  ): Promise<any> {
    return this.request(`/v1/identity/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static async setTeamMemberActive(id: string, active: boolean): Promise<any> {
    const action = active ? 'enable' : 'disable';
    return this.request(`/v1/identity/users/${id}/${action}`, {
      method: 'POST',
    });
  }

  static async resetTeamMemberPassword(id: string, password?: string): Promise<any> {
    return this.request(`/v1/identity/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
    });
  }

  static async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<any> {
    return this.request('/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static clearAuth(): void {
    this.token = null;
    this.refreshToken = null;
  }
}
