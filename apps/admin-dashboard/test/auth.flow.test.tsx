import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/app/(auth)/login/page';
import RegisterPage from '../src/app/(auth)/register/page';
import PanelLayout from '../src/app/(panel)/layout';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/menu',
}));

describe('Bloque 2: Auth Admin Real (Tests Rojo)', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = null;
    ApiClient.refreshToken = null;
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  test('Login envía credenciales tipeadas, guarda tokens en localStorage y navega con router.push', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/auth/login')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tokens: { accessToken: 'real-access-token', refreshToken: 'real-refresh-token' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<LoginPage />);
      const emailInput = screen.getByLabelText(/correo|usuario|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión|entrar/i });

      fireEvent.change(emailInput, { target: { value: 'chef@resto.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/v1/auth/login'),
          expect.objectContaining({
            body: expect.stringContaining('"email":"chef@resto.com"'),
          })
        );
        expect(localStorage.getItem('resto_access_token')).toBe('real-access-token');
        expect(localStorage.getItem('resto_refresh_token')).toBe('real-refresh-token');
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Login input de usuario o correo tiene type="text", label "Usuario o Correo" y placeholder descriptivo', () => {
    render(<LoginPage />);
    const input = screen.getByLabelText('Usuario o Correo');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', 'admin o ejemplo@resto.com');
  });

  test('Login muestra mensaje de error visible con role="alert" ante 401', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Credenciales inválidas' }),
    })) as any;

    try {
      render(<LoginPage />);
      const emailInput = screen.getByLabelText(/correo|usuario|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión|entrar/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@resto.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong' } });
      fireEvent.click(submitBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/inválidas|error/i);
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Register envía datos de registro, guarda tokens y redirige a /menu', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/auth/register')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tokens: { accessToken: 'reg-access-token', refreshToken: 'reg-refresh-token' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<RegisterPage />);
      fireEvent.change(screen.getByLabelText(/nombre del restaurante|restaurante/i), { target: { value: 'La Trattoria' } });
      fireEvent.change(screen.getByLabelText(/correo|email/i), { target: { value: 'owner@trattoria.com' } });
      fireEvent.change(screen.getByLabelText(/contraseña|password/i), { target: { value: 'Pass1234' } });

      const submitBtn = screen.getByRole('button', { name: /registrar|crear cuenta/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(localStorage.getItem('resto_access_token')).toBe('reg-access-token');
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Login muestra estado de loading en el botón primario durante el submit', async () => {
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => fetchPromise) as any;

    try {
      render(<LoginPage />);
      const emailInput = screen.getByLabelText(/correo|usuario|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const submitBtn = screen.getByRole('button', { name: /iniciar sesión|entrar/i });

      fireEvent.change(emailInput, { target: { value: 'chef@resto.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
      fireEvent.click(submitBtn);

      // Botón debe estar deshabilitado y mostrar estado de carga
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveTextContent(/iniciando sesión|cargando/i);

      resolveFetch({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          tokens: { accessToken: 'token', refreshToken: 'refresh' },
        }),
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Register muestra error con role="alert" ante conflicto 409', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'El restaurante o correo ya está registrado' }),
    })) as any;

    try {
      render(<RegisterPage />);
      fireEvent.change(screen.getByLabelText(/nombre del restaurante|restaurante/i), { target: { value: 'La Trattoria' } });
      fireEvent.change(screen.getByLabelText(/correo|email/i), { target: { value: 'duplicado@trattoria.com' } });
      fireEvent.change(screen.getByLabelText(/contraseña|password/i), { target: { value: 'Pass1234' } });

      const submitBtn = screen.getByRole('button', { name: /registrar|crear cuenta/i });
      fireEvent.click(submitBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/registrado|conflicto/i);
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Register maneja NETWORK_ERROR con mensaje descriptivo, ofrece botón Reintentar y preserva los datos del formulario', async () => {
    const originalFetch = global.fetch;
    let attempt = 0;
    const fetchMock = jest.fn(async () => {
      attempt++;
      if (attempt === 1) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({
          tokens: { accessToken: 'retry-access-token', refreshToken: 'retry-refresh-token' },
        }),
      };
    });
    global.fetch = fetchMock as any;

    try {
      render(<RegisterPage />);
      const nameInput = screen.getByLabelText(/nombre del restaurante|restaurante/i);
      const emailInput = screen.getByLabelText(/correo|email/i);
      const passwordInput = screen.getByLabelText(/contraseña|password/i);
      const slugInput = screen.getByLabelText(/slug/i);

      fireEvent.change(nameInput, { target: { value: 'Bistro Central' } });
      fireEvent.change(emailInput, { target: { value: 'bistro@central.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
      fireEvent.change(slugInput, { target: { value: 'bistro-central' } });

      const submitBtn = screen.getByRole('button', { name: /registrar|crear cuenta/i });
      fireEvent.click(submitBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'No pudimos conectar con el servidor. Revisa que esté encendido e inténtalo de nuevo.'
      );

      // Los campos del formulario deben permanecer intactos
      expect(nameInput).toHaveValue('Bistro Central');
      expect(emailInput).toHaveValue('bistro@central.com');
      expect(passwordInput).toHaveValue('Secret123!');
      expect(slugInput).toHaveValue('bistro-central');

      // Botón de reintento visible
      const retryBtn = screen.getByRole('button', { name: /reintentar/i });
      expect(retryBtn).toBeInTheDocument();

      // Al reintentar, se ejecuta la petición y se completa el registro
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(localStorage.getItem('resto_access_token')).toBe('retry-access-token');
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Register muestra estado de loading en el botón primario durante el submit', async () => {
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => fetchPromise) as any;

    try {
      render(<RegisterPage />);
      fireEvent.change(screen.getByLabelText(/nombre del restaurante|restaurante/i), { target: { value: 'La Trattoria' } });
      fireEvent.change(screen.getByLabelText(/correo|email/i), { target: { value: 'admin@trattoria.com' } });
      fireEvent.change(screen.getByLabelText(/contraseña|password/i), { target: { value: 'Pass1234' } });

      const submitBtn = screen.getByRole('button', { name: /registrar|crear cuenta/i });
      fireEvent.click(submitBtn);

      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveTextContent(/creando cuenta|registrando|cargando/i);

      resolveFetch({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: async () => ({
          tokens: { accessToken: 'reg-token', refreshToken: 'reg-refresh' },
        }),
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/menu');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('LoginPage no contiene colores hexadecimales inline y usa tokens Lima & Tinta', () => {
    const { container } = render(<LoginPage />);
    const html = container.innerHTML;
    // No debe contener valores hex tipo #xxxxxx o #xxx
    const hexMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g);
    expect(hexMatches).toBeNull();
  });

  test('RegisterPage no contiene colores hexadecimales inline y usa tokens Lima & Tinta', () => {
    const { container } = render(<RegisterPage />);
    const html = container.innerHTML;
    const hexMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g);
    expect(hexMatches).toBeNull();
  });

  test('PanelLayout: si no hay token en localStorage, router.replace redirige a /login', async () => {
    render(
      <PanelLayout>
        <div>Panel Secreto</div>
      </PanelLayout>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('Panel Secreto')).not.toBeInTheDocument();
  });
});
