import { ApiClient } from '../src/lib/api';

describe('ApiClient - Concurrencia de Refresh Token (R07-front / V07)', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    try {
      delete (window as any).location;
      (window as any).location = { href: 'http://localhost/dashboard', pathname: '/dashboard' };
    } catch {
      // jsdom fallback
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    ApiClient.clearAuth();
    try {
      (window as any).location = originalLocation;
    } catch {
      // jsdom fallback
    }
  });

  const mockJsonResponse = (status: number, body: any) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('5 peticiones simultáneas que reciben 401 generan EXACTAMENTE 1 única llamada HTTP a /v1/auth/refresh y se reintentan exitosamente con el nuevo token', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'valid-refresh-token';

    let refreshCallCount = 0;

    const fetchMock = jest.fn(async (url: string, opts: any = {}) => {
      const urlStr = String(url);

      // Endpoint de refresh: simulamos latencia de red real para garantizar solapamiento de peticiones concurrentes
      if (urlStr.includes('/v1/auth/refresh')) {
        refreshCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return mockJsonResponse(200, {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
          expiresIn: 900,
        });
      }

      // Peticiones de recursos
      const authHeader = opts.headers?.Authorization || '';
      if (authHeader === 'Bearer expired-access-token') {
        // Simulamos respuesta 401 con ligera variación para concurrencia
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockJsonResponse(401, {
          code: 'UNAUTHORIZED',
          message: 'Access token expired',
        });
      }

      if (authHeader === 'Bearer fresh-access-token') {
        return mockJsonResponse(200, {
          endpoint: urlStr,
          retried: opts._retried === true,
        });
      }

      return mockJsonResponse(403, { code: 'FORBIDDEN', message: 'Token unexpected' });
    });

    global.fetch = fetchMock as any;

    const endpoints = [
      '/v1/identity/me',
      '/v1/tables',
      '/v1/menu/categories',
      '/v1/kds/orders',
      '/v1/settings',
    ];

    // Disparamos 5 peticiones simultáneas
    const results = await Promise.all(endpoints.map((ep) => ApiClient.request(ep)));

    // 1. Todas las 5 peticiones deben haber tenido éxito al final
    expect(results).toHaveLength(5);
    results.forEach((res, idx) => {
      expect(res.status).toBe(200);
      expect(res.data.endpoint).toContain(endpoints[idx]);
      expect(res.data.retried).toBe(true);
    });

    // 2. Verificar que EXACTAMENTE 1 única llamada HTTP fue realizada a /v1/auth/refresh
    const refreshCalls = fetchMock.mock.calls.filter(([callUrl]) =>
      String(callUrl).includes('/v1/auth/refresh')
    );
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCallCount).toBe(1);

    const [refreshUrl, refreshOpts] = refreshCalls[0];
    expect(String(refreshUrl)).toContain('/v1/auth/refresh');
    expect(refreshOpts.method).toBe('POST');
    expect(JSON.parse(refreshOpts.body)).toEqual({
      refreshToken: 'valid-refresh-token',
    });

    // 3. Verificar que cada petición se ejecutó dos veces: original (con token viejo) + reintento (con nuevo token)
    endpoints.forEach((ep) => {
      const callsForEp = fetchMock.mock.calls.filter(([callUrl]) =>
        String(callUrl).includes(ep)
      );
      expect(callsForEp).toHaveLength(2);

      // Primera llamada: token viejo
      expect(callsForEp[0][1].headers.Authorization).toBe('Bearer expired-access-token');
      expect(callsForEp[0][1]._retried).toBeUndefined();

      // Segunda llamada: token nuevo con flag _retried
      expect(callsForEp[1][1].headers.Authorization).toBe('Bearer fresh-access-token');
      expect(callsForEp[1][1]._retried).toBe(true);
    });

    // 4. Total de llamadas fetch: 5 iniciales + 1 refresh + 5 reintentos = 11 llamadas
    expect(fetchMock).toHaveBeenCalledTimes(11);

    // 5. Estado final de ApiClient y localStorage actualizado con los nuevos tokens
    expect(ApiClient.token).toBe('fresh-access-token');
    expect(ApiClient.refreshToken).toBe('fresh-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('fresh-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('fresh-refresh-token');

    // 6. La promesa compartida _refreshPromise debe quedar limpia (null)
    expect((ApiClient as any)._refreshPromise).toBeNull();
  });

  it('5 llamadas concurrentes a getValidAccessToken() cuando no hay token pero sí refreshToken ejecutan exactamente 1 llamada HTTP a refresh', async () => {
    ApiClient.token = null;
    ApiClient.refreshToken = 'valid-refresh-token';

    let refreshCallCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/v1/auth/refresh')) {
        refreshCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return mockJsonResponse(200, {
          accessToken: 'new-valid-token',
          refreshToken: 'new-refresh-token',
        });
      }
      return mockJsonResponse(404, {});
    });

    global.fetch = fetchMock as any;

    // 5 llamadas concurrentes a getValidAccessToken()
    const tokens = await Promise.all([
      ApiClient.getValidAccessToken(),
      ApiClient.getValidAccessToken(),
      ApiClient.getValidAccessToken(),
      ApiClient.getValidAccessToken(),
      ApiClient.getValidAccessToken(),
    ]);

    // Todas devuelven el mismo nuevo token
    expect(tokens).toEqual([
      'new-valid-token',
      'new-valid-token',
      'new-valid-token',
      'new-valid-token',
      'new-valid-token',
    ]);

    // Solo 1 llamada a refresh
    expect(refreshCallCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // _refreshPromise limpio
    expect((ApiClient as any)._refreshPromise).toBeNull();
  });

  it('5 peticiones simultáneas con 401 cuando el refresh falla ejecutan exactamente 1 llamada HTTP a refresh y fallan todas con SESSION_EXPIRED', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'revoked-refresh-token';

    let refreshCallCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/auth/refresh')) {
        refreshCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return mockJsonResponse(401, {
          code: 'INVALID_CREDENTIALS',
          message: 'Refresh token revoked',
        });
      }
      return mockJsonResponse(401, {
        code: 'UNAUTHORIZED',
        message: 'Access token expired',
      });
    });

    global.fetch = fetchMock as any;

    const results = await Promise.allSettled([
      ApiClient.request('/v1/req1'),
      ApiClient.request('/v1/req2'),
      ApiClient.request('/v1/req3'),
      ApiClient.request('/v1/req4'),
      ApiClient.request('/v1/req5'),
    ]);

    // Todas deben ser rechazadas con error SESSION_EXPIRED y status 401
    expect(results).toHaveLength(5);
    results.forEach((res) => {
      expect(res.status).toBe('rejected');
      if (res.status === 'rejected') {
        expect(res.reason.status).toBe(401);
        expect(res.reason.code).toBe('SESSION_EXPIRED');
      }
    });

    // Se ejecutó exactamente 1 llamada a refresh
    expect(refreshCallCount).toBe(1);

    // Auth limpiada completamente
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
    expect(localStorage.getItem('resto_access_token')).toBeNull();
    expect(localStorage.getItem('resto_refresh_token')).toBeNull();
    expect((ApiClient as any)._refreshPromise).toBeNull();
  });
});
