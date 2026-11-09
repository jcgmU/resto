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
  private static _authGeneration = 0;
  private static _refreshPromise: Promise<{ accessToken: string; refreshToken?: string } | null> | null = null;
  private static _refreshGeneration: number | null = null;

  private static _bumpGeneration(): void {
    this._authGeneration += 1;
    this._refreshPromise = null;
    this._refreshGeneration = null;
  }

  private static _writeAccessToken(val: string | null): void {
    this._token = val;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (val) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, val);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    }
  }

  private static _writeRefreshToken(val: string | null): void {
    this._refreshToken = val;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (val) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, val);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  }

  private static _applyRefreshedTokens(accessToken: string, refreshToken?: string): void {
    this._writeAccessToken(accessToken);
    if (refreshToken) {
      this._writeRefreshToken(refreshToken);
    }
  }

  static get token(): string | null {
    if (this._token === null && typeof window !== 'undefined' && window.localStorage) {
      this._token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return this._token;
  }

  static set token(val: string | null) {
    this._bumpGeneration();
    this._writeAccessToken(val);
  }

  static get refreshToken(): string | null {
    if (this._refreshToken === null && typeof window !== 'undefined' && window.localStorage) {
      this._refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return this._refreshToken;
  }

  static set refreshToken(val: string | null) {
    this._bumpGeneration();
    this._writeRefreshToken(val);
  }

  private static _createSessionExpiredError(): any {
    const sessionExpiredError: any = new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    sessionExpiredError.status = 401;
    sessionExpiredError.code = 'SESSION_EXPIRED';
    return sessionExpiredError;
  }

  private static async _performRefresh(
    baseUrl: string,
    refreshGen: number,
    refreshTokenToUse: string
  ): Promise<{ accessToken: string; refreshToken?: string } | null> {
    let refreshedTokens: { accessToken: string; refreshToken?: string } | null = null;
    try {
      const refreshRes = await fetch(`${baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenToUse }),
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
    } finally {
      if (this._refreshGeneration === refreshGen) {
        this._refreshPromise = null;
        this._refreshGeneration = null;
      }
    }

    // Si la generación cambió mientras el refresh estaba en vuelo (logout o nuevo login),
    // ignoramos el resultado para no pisar ni limpiar la nueva sesión.
    if (this._authGeneration !== refreshGen) {
      return null;
    }

    if (refreshedTokens?.accessToken) {
      this._applyRefreshedTokens(refreshedTokens.accessToken, refreshedTokens.refreshToken);
      return refreshedTokens;
    }

    this.clearAuth();
    if (typeof window !== 'undefined' && window.location) {
      try {
        window.location.href = '/login';
      } catch {
        // fallback en entornos donde location.href es de sólo lectura
      }
    }
    return null;
  }

  static async request(url: string, options: any = {}): Promise<any> {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:4000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    const requestGeneration = ApiClient._authGeneration;
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
        url !== '/v1/auth/refresh'
      ) {
        // Si la sesión sigue en la misma generación y otra petición hermana ya rotó el accessToken,
        // reintentamos directamente con el nuevo token sin disparar otro refresh.
        if (
          ApiClient._authGeneration === requestGeneration &&
          ApiClient.token &&
          ApiClient.token !== token
        ) {
          return ApiClient.request(url, { ...options, _retried: true });
        }

        // Si seguimos en la misma generación y hay refreshToken disponible, coordinamos un único refresh.
        if (
          ApiClient._authGeneration === requestGeneration &&
          ApiClient.refreshToken
        ) {
          if (!ApiClient._refreshPromise || ApiClient._refreshGeneration !== requestGeneration) {
            ApiClient._refreshGeneration = requestGeneration;
            ApiClient._refreshPromise = ApiClient._performRefresh(
              baseUrl,
              requestGeneration,
              ApiClient.refreshToken
            );
          }

          const refreshedTokens = await ApiClient._refreshPromise;

          if (
            ApiClient._authGeneration === requestGeneration &&
            refreshedTokens?.accessToken
          ) {
            return ApiClient.request(url, { ...options, _retried: true });
          }

          throw ApiClient._createSessionExpiredError();
        }
      }

      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      
      if (!res.ok) {
        const errObj =
          data && typeof data === 'object' && data.error && typeof data.error === 'object'
            ? data.error
            : data;
        const error: any = new Error(errObj?.message || data?.message || 'Error en la petición');
        error.status = res.status;
        error.code = errObj?.code || data?.code || 'UNKNOWN';
        if ((errObj?.details ?? data?.details) !== undefined) {
          error.details = errObj?.details ?? data?.details;
        }
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
