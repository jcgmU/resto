import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { PwaApiClient } from '../src/lib/api';

// Tests listos para la ejecución de U12 (menu/page.tsx)
describe('U12: PWA Menu — Tabs funcionales y estados L/E/E', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = null;
    PwaApiClient.session = null;
  });

  test('U12: Tabs de categorías funcionales filtran platos por categoría y la opción "Todas" muestra el catálogo completo', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';
    PwaApiClient.session = { sessionId: 'sess-real', tableId: 'tb-real', tenantId: 'tenant-real' };

    const fetchMock = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-bebidas', name: 'Bebidas' },
                { id: 'cat-postres', name: 'Postres' },
              ],
              products: [
                { id: 'prod-1', name: 'Limonada Natural', price: 25, categoryId: 'cat-bebidas', isAvailable: true },
                { id: 'prod-2', name: 'Agua Mineral', price: 20, categoryId: 'cat-bebidas', isAvailable: true },
                { id: 'prod-3', name: 'Flan Casero', price: 35, categoryId: 'cat-postres', isAvailable: true },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      // Inicialmente se cargan todos los productos
      await waitFor(() => {
        expect(screen.getByText('Limonada Natural')).toBeInTheDocument();
        expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
        expect(screen.getByText('Flan Casero')).toBeInTheDocument();
      });

      // Filtrar por 'Bebidas'
      const bebidasTab = screen.getByRole('tab', { name: /Bebidas/i });
      fireEvent.click(bebidasTab);

      expect(screen.getByText('Limonada Natural')).toBeInTheDocument();
      expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
      expect(screen.queryByText('Flan Casero')).not.toBeInTheDocument();

      // Filtrar por 'Postres'
      const postresTab = screen.getByRole('tab', { name: /Postres/i });
      fireEvent.click(postresTab);

      expect(screen.queryByText('Limonada Natural')).not.toBeInTheDocument();
      expect(screen.queryByText('Agua Mineral')).not.toBeInTheDocument();
      expect(screen.getByText('Flan Casero')).toBeInTheDocument();

      // Volver a 'Todas'
      const todasTab = screen.getByRole('tab', { name: /Todas/i });
      fireEvent.click(todasTab);

      expect(screen.getByText('Limonada Natural')).toBeInTheDocument();
      expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
      expect(screen.getByText('Flan Casero')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U12: Estado loading muestra skeletons estructurados del kit mientras se carga el menú', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';

    let resolveFetch: (val: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        return fetchPromise;
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      // Debe mostrar el contenedor de carga o esqueletos del kit
      expect(screen.getByTestId('menu-loading')).toBeInTheDocument();

      // Resolver la promesa
      resolveFetch!({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          data: {
            categories: [{ id: 'cat-1', name: 'Entradas' }],
            products: [{ id: 'p-1', name: 'Guacamole', price: 40, categoryId: 'cat-1', isAvailable: true }],
          },
        }),
      });

      // Se oculta el loading y aparecen los productos
      await waitFor(() => {
        expect(screen.queryByTestId('menu-loading')).not.toBeInTheDocument();
        expect(screen.getByText('Guacamole')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U12: Estado empty muestra EmptyState accesible si el menú no tiene productos o la categoría está vacía', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';

    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-1', name: 'Entradas' },
                { id: 'cat-vacia', name: 'Especiales' },
              ],
              products: [
                { id: 'p-1', name: 'Nachos', price: 50, categoryId: 'cat-1', isAvailable: true },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      await waitFor(() => {
        expect(screen.getByText('Nachos')).toBeInTheDocument();
      });

      // Seleccionar la categoría vacía
      const vaciaTab = screen.getByRole('tab', { name: /Especiales/i });
      fireEvent.click(vaciaTab);

      // Debe mostrar EmptyState
      expect(screen.getByText('No hay platos en esta categoría')).toBeInTheDocument();
      expect(screen.queryByText('Nachos')).not.toBeInTheDocument();

      // Botón para volver a todas
      const verTodasBtn = screen.getByRole('button', { name: /ver todos los platos/i });
      fireEvent.click(verTodasBtn);

      expect(screen.getByText('Nachos')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('U12: Estado error captura fallo en fetchMenu con .catch, muestra ErrorState y permite reintentar', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';

    let failCount = 1;
    global.fetch = jest.fn(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/graphql')) {
        if (failCount > 0) {
          failCount--;
          throw new Error('Fallo de conexión al cargar menú');
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
              products: [{ id: 'p-recuperado', name: 'Plato Recuperado', price: 55, categoryId: 'cat-1', isAvailable: true }],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      // Debe mostrar ErrorState con role="alert" y mensaje
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Fallo de conexión al cargar menú/i);

      // Reintentar
      const retryBtn = screen.getByRole('button', { name: /reintentar/i });
      fireEvent.click(retryBtn);

      // Tras reintentar, se recupera el menú
      await waitFor(() => {
        expect(screen.getByText('Plato Recuperado')).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('D9.2 & D9.3: Menú PWA renderiza h1 "Carta" y skeletons de categorías con altura de 44px', async () => {
    const originalFetch = global.fetch;
    PwaApiClient.guestToken = 'token-guest-real';
    PwaApiClient.session = { sessionId: 'sess-real', tableId: 'tb-real', tenantId: 'tenant-real' };

    // Simular promesa pendiente para verificar estado de carga y skeletons
    global.fetch = jest.fn(() => new Promise(() => {})) as any;

    try {
      render(<ClientMenuPage params={{ tenantId: 'tenant-real', tableId: 'tb-real' }} />);

      // D9.2: Header con h1 Carta
      const h1 = screen.getByRole('heading', { level: 1, name: 'Carta' });
      expect(h1).toBeInTheDocument();

      // D9.3: Skeletons de categorías con altura de 44px
      const loadingContainer = screen.getByTestId('menu-loading');
      expect(loadingContainer).toBeInTheDocument();
      const skeletons = loadingContainer.querySelectorAll('[data-component="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
      skeletons.forEach((s) => {
        expect(s).toHaveStyle({ height: '44px' });
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
