import { ApiClient } from '../src/lib/api';

describe('ApiClient - Métodos de Equipo y Cambio de Contraseña (U6)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    ApiClient.clearAuth();
    ApiClient.token = 'mock-admin-token';
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

  it('listTeam realiza GET /v1/identity/users con Authorization header', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(200, [{ id: 'u1', email: 'staff@resto.com', role: 'STAFF' }])
    );
    global.fetch = fetchMock as any;

    const res = await ApiClient.listTeam();
    expect(res.status).toBe(200);
    expect(res.data).toEqual([{ id: 'u1', email: 'staff@resto.com', role: 'STAFF' }]);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/identity/users');
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBe('Bearer mock-admin-token');
  });

  it('createTeamMember realiza POST /v1/identity/users con payload JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(201, { id: 'u2', email: 'manager@resto.com', role: 'MANAGER', status: 'ACTIVE' })
    );
    global.fetch = fetchMock as any;

    const payload = {
      email: 'manager@resto.com',
      displayName: 'Manager Uno',
      role: 'MANAGER' as const,
      password: 'password123',
    };

    const res = await ApiClient.createTeamMember(payload);
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('ACTIVE');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/identity/users');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  it('updateTeamMember realiza PATCH /v1/identity/users/:id con payload JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(200, { id: 'u2', displayName: 'Manager Modificado', role: 'STAFF' })
    );
    global.fetch = fetchMock as any;

    const res = await ApiClient.updateTeamMember('u2', {
      displayName: 'Manager Modificado',
      role: 'STAFF',
    });
    expect(res.status).toBe(200);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/identity/users/u2');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({
      displayName: 'Manager Modificado',
      role: 'STAFF',
    });
  });

  it('setTeamMemberActive realiza POST enable o disable según parámetro', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(200, { id: 'u3', status: 'DISABLED' }))
      .mockResolvedValueOnce(mockJsonResponse(200, { id: 'u3', status: 'ACTIVE' }));
    global.fetch = fetchMock as any;

    // Desactivar
    await ApiClient.setTeamMemberActive('u3', false);
    const [url1, opts1] = fetchMock.mock.calls[0];
    expect(String(url1)).toContain('/v1/identity/users/u3/disable');
    expect(opts1.method).toBe('POST');

    // Activar
    await ApiClient.setTeamMemberActive('u3', true);
    const [url2, opts2] = fetchMock.mock.calls[1];
    expect(String(url2)).toContain('/v1/identity/users/u3/enable');
    expect(opts2.method).toBe('POST');
  });

  it('resetTeamMemberPassword realiza POST /v1/identity/users/:id/reset-password', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(200, { message: 'ok', password: 'newpass123' })
    );
    global.fetch = fetchMock as any;

    const res = await ApiClient.resetTeamMemberPassword('u4', 'custom-password123');
    expect(res.status).toBe(200);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/identity/users/u4/reset-password');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ password: 'custom-password123' });
  });

  it('changePassword realiza POST /v1/auth/change-password con currentPassword y newPassword', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockJsonResponse(200, { message: 'ok' })
    );
    global.fetch = fetchMock as any;

    const res = await ApiClient.changePassword({
      currentPassword: 'current123',
      newPassword: 'newpassword123',
    });
    expect(res.status).toBe(200);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/auth/change-password');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      currentPassword: 'current123',
      newPassword: 'newpassword123',
    });
  });
});
