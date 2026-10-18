import { PwaApiClient } from '../src/lib/api';

describe('PwaApiClient - Manejo de guestToken expirado / 401 (H10)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.clearAuth();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    PwaApiClient.clearAuth();
  });

  const mock401Response = () => ({
    ok: false,
    status: 401,
    headers: { get: () => 'application/json' },
    json: async () => ({ code: 'UNAUTHORIZED', message: 'Guest session expired' }),
    text: async () => JSON.stringify({ code: 'UNAUTHORIZED', message: 'Guest session expired' }),
  });

  it('getCart() ante 401 limpia guestToken y session en memoria y sessionStorage, y lanza error descriptivo', async () => {
    PwaApiClient.guestToken = 'token-expirado-123';
    PwaApiClient.session = { sessionId: 's-1', tenantId: 't-1', tableId: 'tbl-1', status: 'active' };

    expect(sessionStorage.getItem('resto_guest_token')).toBe('token-expirado-123');
    expect(sessionStorage.getItem('resto_guest_session')).toBeTruthy();

    global.fetch = jest.fn().mockResolvedValue(mock401Response()) as any;

    let error: any = null;
    try {
      await PwaApiClient.getCart();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(401);
    expect(error.message).toBe('Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.');

    // guestToken y session deben quedar en null
    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();
    expect(sessionStorage.getItem('resto_guest_token')).toBeNull();
    expect(sessionStorage.getItem('resto_guest_session')).toBeNull();
  });

  it('addToCart() ante 401 limpia guestToken y session y arroja el mensaje de re-escanear QR', async () => {
    PwaApiClient.guestToken = 'token-expirado-456';
    PwaApiClient.session = { sessionId: 's-2', tenantId: 't-1', tableId: 'tbl-2', status: 'active' };

    global.fetch = jest.fn().mockResolvedValue(mock401Response()) as any;

    await expect(
      PwaApiClient.addToCart({ productId: 'prod-1', quantity: 2 })
    ).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.',
    });

    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();
    expect(sessionStorage.getItem('resto_guest_token')).toBeNull();
  });

  it('confirmOrder() ante 401 limpia sesión y lanza error descriptivo', async () => {
    PwaApiClient.guestToken = 'token-expirado-789';
    PwaApiClient.session = { sessionId: 's-3', tenantId: 't-1', tableId: 'tbl-3', status: 'active' };

    global.fetch = jest.fn().mockResolvedValue(mock401Response()) as any;

    await expect(PwaApiClient.confirmOrder('tbl-3')).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.',
    });

    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();
  });

  it('requestBill() y getOrder() ante 401 limpian sesión y lanzan error descriptivo', async () => {
    PwaApiClient.guestToken = 'token-bill-expired';
    PwaApiClient.session = { sessionId: 's-5', tenantId: 't-1', tableId: 'tbl-5', status: 'active' };

    global.fetch = jest.fn().mockResolvedValue(mock401Response()) as any;

    await expect(PwaApiClient.requestBill('tbl-5')).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.',
    });

    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();

    // getOrder
    PwaApiClient.guestToken = 'token-order-expired';
    PwaApiClient.session = { sessionId: 's-5', tenantId: 't-1', tableId: 'tbl-5', status: 'active' };

    await expect(PwaApiClient.getOrder('order-123')).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.',
    });

    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();
  });

  it('fetchMenu() ante 401 limpia sesión y lanza error descriptivo', async () => {
    PwaApiClient.guestToken = 'token-menu-expired';
    PwaApiClient.session = { sessionId: 's-6', tenantId: 't-1', tableId: 'tbl-6', status: 'active' };

    global.fetch = jest.fn().mockResolvedValue(mock401Response()) as any;

    await expect(PwaApiClient.fetchMenu('t-1')).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha expirado. Por favor, escanea nuevamente el código QR de tu mesa.',
    });

    expect(PwaApiClient.guestToken).toBeNull();
    expect(PwaApiClient.session).toBeNull();
  });
});
