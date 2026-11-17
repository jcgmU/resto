import React from 'react';
import '@testing-library/jest-dom';
import { render, waitFor } from '@testing-library/react';
import TerminalShell from '../src/app/(terminal)/TerminalShell';
import { ApiClient } from '../src/lib/api';
import { isTerminalRouteAllowed, terminalHomeForRole } from '../src/lib/auth';

const mockReplace = jest.fn();
let mockPathname = '/terminal-mesero';

const mockRouter = { push: jest.fn(), replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

const ROUTES = ['/terminal-mesero', '/terminal-caja', '/monitor'] as const;
const HOME: Record<string, string> = {
  WAITER: '/terminal-mesero',
  CASHIER: '/terminal-caja',
  MONITOR: '/monitor',
};

describe('Guardas de terminales por rol', () => {
  test.each(['ADMIN', 'MANAGER'])('%s abre todas las terminales', (role) => {
    for (const route of ROUTES) expect(isTerminalRouteAllowed(route, role)).toBe(true);
  });

  test.each(Object.keys(HOME))('%s solo abre su terminal', (role) => {
    for (const route of ROUTES) {
      expect(isTerminalRouteAllowed(route, role)).toBe(route === HOME[role]);
    }
    expect(terminalHomeForRole(role)).toBe(HOME[role]);
  });

  test('STAFF ya no es un rol válido para terminales', () => {
    expect(terminalHomeForRole('STAFF')).toBeNull();
    for (const route of ROUTES) expect(isTerminalRouteAllowed(route, 'STAFF')).toBe(false);
  });

  describe('TerminalShell redirige al rol equivocado a su terminal', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      localStorage.clear();
      ApiClient.token = 'valid-token';
    });

    const cases = Object.keys(HOME).flatMap((role) => ROUTES.map((route) => ({ role, route })));
    test.each(cases)('$role en $route', async ({ role, route }) => {
      mockPathname = route;
      localStorage.setItem('resto_user', JSON.stringify({ id: 'u1', role, displayName: 'X' }));
      render(
        <TerminalShell>
          <div data-testid="contenido">pantalla</div>
        </TerminalShell>
      );
      if (route === HOME[role]) {
        await waitFor(() => expect(document.querySelector('[data-testid="contenido"]')).not.toBeNull());
        expect(mockReplace).not.toHaveBeenCalledWith(expect.stringMatching(/^\/(terminal|monitor)/));
      } else {
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(HOME[role]));
        expect(document.querySelector('[data-testid="contenido"]')).toBeNull();
      }
    });

    test.each(['ADMIN', 'MANAGER'])('%s no es redirigido en ninguna terminal', async (role) => {
      for (const route of ROUTES) {
        mockReplace.mockClear();
        mockPathname = route;
        localStorage.setItem('resto_user', JSON.stringify({ id: 'u1', role, displayName: 'X' }));
        const { unmount } = render(
          <TerminalShell>
            <div data-testid="contenido">pantalla</div>
          </TerminalShell>
        );
        await waitFor(() => expect(document.querySelector('[data-testid="contenido"]')).not.toBeNull());
        expect(mockReplace).not.toHaveBeenCalled();
        unmount();
      }
    });
  });
});
