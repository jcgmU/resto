import { ApiClient } from '../src/lib/api';

describe('ApiClient - Manejo de Token Vencido y Refresh (H10)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    ApiClient.clearAuth();
  });

  const mockJsonResponse = (status: number, body: any) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('(a) 401 en petición normal dispara POST /v1/auth/refresh; tras recibir nuevo accessToken, reintenta la petición original con el nuevo token y tiene éxito', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'valid-refresh-token';

    const fetchMock = jest
      .fn()
      // 1. Petición original -> 401 Unauthorized
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Access token expired' })
      )
      // 2. Intento de refresh -> 200 OK con nuevo accessToken y nuevo refreshToken
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
          expiresIn: 900,
        })
      )
      // 3. Reintento de la petición original con nuevo token -> 200 OK
      .mockResolvedValueOnce(
        mockJsonResponse(200, { id: 'u1', email: 'admin@resto.test' })
      );

    global.fetch = fetchMock as any;

    const res = await ApiClient.request('/v1/identity/me');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 'u1', email: 'admin@resto.test' });

    // Verificamos los 3 llamados
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Llamado 1: Original con token expirado
    const [url1, opts1] = fetchMock.mock.calls[0];
    expect(String(url1)).toContain('/v1/identity/me');
    expect(opts1.headers.Authorization).toBe('Bearer expired-access-token');

    // Llamado 2: Refresh token endpoint
    const [url2, opts2] = fetchMock.mock.calls[1];
    expect(String(url2)).toContain('/v1/auth/refresh');
    expect(opts2.method).toBe('POST');
    expect(JSON.parse(opts2.body)).toEqual({ refreshToken: 'valid-refresh-token' });

    // Llamado 3: Reintento con nuevo token y _retried flag
    const [url3, opts3] = fetchMock.mock.calls[2];
    expect(String(url3)).toContain('/v1/identity/me');
    expect(opts3.headers.Authorization).toBe('Bearer fresh-access-token');
    expect(opts3._retried).toBe(true);

    // Verificamos actualización en memoria y localStorage
    expect(ApiClient.token).toBe('fresh-access-token');
    expect(ApiClient.refreshToken).toBe('fresh-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('fresh-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('fresh-refresh-token');
  });

  it('(b) 401 en petición normal dispara POST /v1/auth/refresh; si el refresh falla con 401, se limpian los tokens de ApiClient y localStorage y se redirige a /login', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'expired-refresh-token';

    expect(localStorage.getItem('resto_access_token')).toBe('expired-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('expired-refresh-token');

    // Mockeamos window.location para verificar redirección
    const originalLocation = window.location;
    const locationMock = {
      href: 'http://localhost/dashboard',
      pathname: '/dashboard',
    };
    try {
      delete (window as any).location;
      (window as any).location = locationMock;
    } catch {
      // jsdom puede impedir delete en algunas versiones
    }

    const fetchMock = jest
      .fn()
      // 1. Petición original -> 401 Unauthorized
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Access token expired' })
      )
      // 2. Refresh falla -> 401 Invalid Refresh Token
      .mockResolvedValueOnce(
        mockJsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Refresh token expired' })
      );

    global.fetch = fetchMock as any;

    let thrownError: any = null;
    try {
      await ApiClient.request('/v1/identity/me');
    } catch (err) {
      thrownError = err;
    } finally {
      // Restaurar location
      try {
        (window as any).location = originalLocation;
      } catch {
        // ignore
      }
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.status).toBe(401);
    expect(thrownError.message).toMatch(/sesión ha expirado/i);

    // Refresh fue llamado una vez
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Tokens en ApiClient y localStorage deben haberse limpiado completamente
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
    expect(localStorage.getItem('resto_access_token')).toBeNull();
    expect(localStorage.getItem('resto_refresh_token')).toBeNull();

    // Redirección a /login verificada en el mock
    expect(locationMock.href).toBe('/login');
  });

  it('(c) Petición con _retried: true ante 401 no reintenta en bucle', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'some-refresh-token';

    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Token still invalid' })
    );

    global.fetch = fetchMock as any;

    let thrownError: any = null;
    try {
      await ApiClient.request('/v1/identity/me', { _retried: true });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.status).toBe(401);

    // Se ejecutó EXACTAMENTE 1 sola vez; no disparó POST /v1/auth/refresh ni bucle infinito
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).not.toContain('/v1/auth/refresh');
  });

  it('(d) 401 simultáneos comparten una única promesa de refresh rotatorio y ambas peticiones reintentan con éxito sin perder sesión', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'single-use-refresh-token';

    let refreshCallCount = 0;
    const fetchMock = jest.fn(async (url: string, opts: any = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/auth/refresh')) {
        refreshCallCount += 1;
        const body = JSON.parse(opts.body || '{}');
        // El backend rota y revoca el refresh token tras el primer uso
        if (refreshCallCount === 1 && body.refreshToken === 'single-use-refresh-token') {
          await new Promise((r) => setTimeout(r, 20));
          return mockJsonResponse(200, {
            accessToken: 'rotated-access-token',
            refreshToken: 'rotated-refresh-token',
            expiresIn: 900,
          });
        }
        return mockJsonResponse(401, {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token already used or revoked',
        });
      }

      if (opts.headers?.Authorization === 'Bearer rotated-access-token') {
        return mockJsonResponse(200, { url: urlStr, ok: true });
      }

      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired' });
    });

    global.fetch = fetchMock as any;

    const [resA, resB] = await Promise.all([
      ApiClient.request('/v1/identity/me'),
      ApiClient.request('/v1/identity/users'),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(refreshCallCount).toBe(1);
    expect(ApiClient.token).toBe('rotated-access-token');
    expect(ApiClient.refreshToken).toBe('rotated-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('rotated-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('rotated-refresh-token');
  });

  it('(e) 401 tardío de una petición que salió con accessToken viejo reutiliza el token ya refrescado sin disparar un segundo refresh', async () => {
    ApiClient.token = 'old-access-token';
    ApiClient.refreshToken = 'initial-refresh-token';

    let resolveSlow401!: (val: any) => void;
    const slow401Promise = new Promise((resolve) => {
      resolveSlow401 = resolve;
    });

    let refreshCallCount = 0;
    const fetchMock = jest.fn(async (url: string, opts: any = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/auth/refresh')) {
        refreshCallCount += 1;
        if (refreshCallCount === 1) {
          return mockJsonResponse(200, {
            accessToken: 'fresh-access-token',
            refreshToken: 'fresh-refresh-token',
          });
        }
        return mockJsonResponse(401, { code: 'REVOKED', message: 'Already rotated' });
      }

      if (urlStr.includes('/v1/slow') && !opts._retried) {
        return slow401Promise;
      }

      if (opts.headers?.Authorization === 'Bearer fresh-access-token') {
        return mockJsonResponse(200, { url: urlStr, retriedWithFresh: true });
      }

      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired' });
    });

    global.fetch = fetchMock as any;

    // 1. Inicia la petición lenta con 'old-access-token'
    const slowReq = ApiClient.request('/v1/slow');

    // 2. Otra petición rápida recibe 401 y completa el refresh antes de que /v1/slow responda
    const fastRes = await ApiClient.request('/v1/fast');
    expect(fastRes.status).toBe(200);
    expect(refreshCallCount).toBe(1);
    expect(ApiClient.token).toBe('fresh-access-token');

    // 3. Ahora llega el 401 tardío de /v1/slow (que había salido con 'old-access-token')
    resolveSlow401(mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired old token' }));

    const slowRes = await slowReq;
    expect(slowRes.status).toBe(200);
    expect(slowRes.data).toEqual({ url: expect.stringContaining('/v1/slow'), retriedWithFresh: true });
    // No debió disparar un segundo /v1/auth/refresh
    expect(refreshCallCount).toBe(1);
  });

  it('(f) Si el refresh compartido falla con 401, todas las peticiones concurrentes rechazan con SESSION_EXPIRED sin bucle y liberan el bloqueo para futuros intentos', async () => {
    ApiClient.token = 'expired-access-token';
    ApiClient.refreshToken = 'invalid-refresh-token';

    let refreshCallCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/v1/auth/refresh')) {
        refreshCallCount += 1;
        await new Promise((r) => setTimeout(r, 15));
        return mockJsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Expired refresh' });
      }
      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired access' });
    });

    global.fetch = fetchMock as any;

    const results = await Promise.allSettled([
      ApiClient.request('/v1/a'),
      ApiClient.request('/v1/b'),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect((results[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });
    expect((results[1] as PromiseRejectedResult).reason).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });
    expect(refreshCallCount).toBe(1);
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
  });

  it('(g) Logout (clearAuth) durante un refresh en vuelo impide que el refresh tardío restaure tokens o reintente la petición vieja', async () => {
    ApiClient.token = 'gen1-expired-access';
    ApiClient.refreshToken = 'gen1-refresh';

    let resolveRefresh!: (val: any) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/v1/auth/refresh')) {
        return refreshPromise;
      }
      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired' });
    });

    global.fetch = fetchMock as any;

    const pendingReq = ApiClient.request('/v1/identity/me');

    // Esperar un tick para que entre al refresh
    await new Promise((r) => setTimeout(r, 10));

    // Usuario hace logout mientras el refresh sigue en vuelo
    ApiClient.clearAuth();
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();

    // El refresh de la generación anterior responde 200 tardíamente
    resolveRefresh(
      mockJsonResponse(200, {
        accessToken: 'zombie-access-token',
        refreshToken: 'zombie-refresh-token',
      })
    );

    await expect(pendingReq).rejects.toMatchObject({ status: 401 });

    // No debe haber restaurado los tokens zombie ni reintentado la petición
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
    expect(localStorage.getItem('resto_access_token')).toBeNull();
    expect(localStorage.getItem('resto_refresh_token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 request inicial + 1 refresh, 0 reintentos
  });

  it('(h) Nuevo login durante un refresh antiguo en vuelo no es sobrescrito ni limpiado cuando el refresh viejo falla o tiene éxito', async () => {
    ApiClient.token = 'gen1-expired-access';
    ApiClient.refreshToken = 'gen1-refresh';

    let resolveOldRefresh!: (val: any) => void;
    const oldRefreshPromise = new Promise((resolve) => {
      resolveOldRefresh = resolve;
    });

    const fetchMock = jest.fn(async (url: string, opts: any = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/auth/refresh')) {
        return oldRefreshPromise;
      }
      if (urlStr.includes('/v1/auth/login')) {
        return mockJsonResponse(200, {
          user: { id: 'u2' },
          tokens: {
            accessToken: 'gen2-access-token',
            refreshToken: 'gen2-refresh-token',
          },
        });
      }
      if (opts.headers?.Authorization === 'Bearer gen2-access-token') {
        return mockJsonResponse(200, { ok: true, gen: 2 });
      }
      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Gen1 expired' });
    });

    global.fetch = fetchMock as any;

    const gen1Req = ApiClient.request('/v1/identity/me');
    await new Promise((r) => setTimeout(r, 10));

    // Mientras el refresh de gen1 está colgado, ocurre un nuevo login (gen2)
    await ApiClient.login({ email: 'new@resto.test', password: 'secret' });
    expect(ApiClient.token).toBe('gen2-access-token');
    expect(ApiClient.refreshToken).toBe('gen2-refresh-token');

    // Ahora el refresh viejo de gen1 falla con 401: NO debe limpiar los tokens de gen2
    resolveOldRefresh(
      mockJsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Old refresh failed' })
    );

    await expect(gen1Req).rejects.toMatchObject({ status: 401 });

    expect(ApiClient.token).toBe('gen2-access-token');
    expect(ApiClient.refreshToken).toBe('gen2-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('gen2-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('gen2-refresh-token');
  });

  it('(h2) Si el refresh viejo de gen1 resuelve con 200 después de un login gen2, no sobrescribe los tokens de gen2 ni reutiliza la promesa vieja', async () => {
    ApiClient.token = 'gen1-expired-access';
    ApiClient.refreshToken = 'gen1-refresh';

    let resolveOldRefresh!: (val: any) => void;
    const oldRefreshPromise = new Promise((resolve) => {
      resolveOldRefresh = resolve;
    });

    const fetchMock = jest.fn(async (url: string, opts: any = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1/auth/refresh')) {
        return oldRefreshPromise;
      }
      if (urlStr.includes('/v1/auth/login')) {
        return mockJsonResponse(200, {
          user: { id: 'u2' },
          tokens: {
            accessToken: 'gen2-access-token',
            refreshToken: 'gen2-refresh-token',
          },
        });
      }
      if (opts.headers?.Authorization === 'Bearer gen2-access-token') {
        return mockJsonResponse(200, { ok: true, gen: 2 });
      }
      return mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Gen1 expired' });
    });

    global.fetch = fetchMock as any;

    const gen1Req = ApiClient.request('/v1/identity/me');
    await new Promise((r) => setTimeout(r, 10));

    await ApiClient.login({ email: 'new@resto.test', password: 'secret' });

    // El refresh antiguo responde 200 con tokens de gen1 tardíos
    resolveOldRefresh(
      mockJsonResponse(200, {
        accessToken: 'gen1-late-access-token',
        refreshToken: 'gen1-late-refresh-token',
      })
    );

    await expect(gen1Req).rejects.toMatchObject({ status: 401 });

    // Los tokens de gen2 siguen intactos
    expect(ApiClient.token).toBe('gen2-access-token');
    expect(ApiClient.refreshToken).toBe('gen2-refresh-token');
    expect(localStorage.getItem('resto_access_token')).toBe('gen2-access-token');
    expect(localStorage.getItem('resto_refresh_token')).toBe('gen2-refresh-token');
  });

  it('(i) 401 antiguo que llega después de clearAuth() falla sin disparar /v1/auth/refresh', async () => {
    ApiClient.token = 'gen1-access';
    ApiClient.refreshToken = 'gen1-refresh';

    let resolveInitial401!: (val: any) => void;
    const initial401Promise = new Promise((resolve) => {
      resolveInitial401 = resolve;
    });

    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/v1/auth/refresh')) {
        return mockJsonResponse(200, {
          accessToken: 'should-not-be-called',
          refreshToken: 'should-not-be-called',
        });
      }
      return initial401Promise;
    });

    global.fetch = fetchMock as any;

    const req = ApiClient.request('/v1/identity/me');

    // Logout ocurre mientras la petición original aún está esperando respuesta del servidor
    ApiClient.clearAuth();

    // Llega el 401 de la petición antes del logout
    resolveInitial401(mockJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Expired' }));

    await expect(req).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ApiClient.token).toBeNull();
    expect(ApiClient.refreshToken).toBeNull();
  });
});
