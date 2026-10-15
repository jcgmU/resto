import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MenuPage from '../src/app/(panel)/menu/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));

describe('Bloque 3: Menu Admin Real (Tests Rojo)', () => {
  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-admin-token';
    mockPush.mockClear();
  });

  test('Carga categorías y productos mapeando category.id a categoryId para la lista y formulario', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query && (body.query.includes('categories') || body.query.includes('products'))) {
          // Confirma que la query pide category { id } y NO categoryId
          expect(body.query).toContain('category {');
          expect(body.query).not.toContain('products { id name price categoryId isAvailable }');

          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                categories: [
                  { id: 'cat-1', name: 'Pizzas' },
                  { id: 'cat-2', name: 'Bebidas' },
                ],
                products: [
                  {
                    id: 'prod-1',
                    name: 'Pizza Napolitana',
                    price: 1200,
                    isAvailable: true,
                    category: { id: 'cat-1' },
                  },
                ],
              },
            }),
          };
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Pizzas')).toBeInTheDocument();
        expect(screen.getByText('Bebidas')).toBeInTheDocument();
        expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Ante error de GraphQL al cargar menú: NO muestra categorías inventadas (Entradas/Platos Fuertes) y muestra mensaje de error visible con role="alert"', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      if (url.toString().includes('/v1/graphql')) {
        return {
          ok: false,
          status: 400,
          headers: { get: () => 'application/json' },
          json: async () => ({
            errors: [{ message: 'Cannot query field categoryId on type Product' }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/error/i);

      // NO debe tener datos inventados
      expect(screen.queryByText('Entradas')).not.toBeInTheDocument();
      expect(screen.queryByText('Platos Fuertes')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Creación fallida de producto: NO muestra éxito ("Nuevo Producto Creado") y muestra error en role="alert"', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('mutation')) {
          return {
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({
              errors: [{ message: 'Field createProduct not found' }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Postres' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Postres')).toBeInTheDocument();
      });

      const openBtn = screen.getByRole('button', { name: /nuevo producto/i });
      fireEvent.click(openBtn);

      fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Tiramisú' } });
      fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '450' } });

      const saveBtn = screen.getByRole('button', { name: /guardar|crear producto/i });
      fireEvent.click(saveBtn);

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.queryByText(/Nuevo Producto Creado/i)).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HALLAZGO 2: Empty state cuando no hay categorías guía a crear categoría y bloquea o no ofrece Nuevo Producto', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any) => {
      if (url.toString().includes('/v1/graphql')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText(/crea tu primera categoría/i)).toBeInTheDocument();
      });

      // El botón de Nueva Categoría debe estar visible
      const catBtns = screen.getAllByRole('button', { name: /nueva categoría|crear categoría/i });
      expect(catBtns.length).toBeGreaterThan(0);
      // Nuevo producto no debe estar activo/disponible si no hay categorías
      const nuevoProdBtn = screen.queryByRole('button', { name: /nuevo producto/i });
      expect(nuevoProdBtn).toBeDisabled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('HALLAZGO 2: Crear categoría real dispara mutation createCategory con name y sortOrder y refresca la lista', async () => {
    let categoryCreated = false;
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: any, opts: any) => {
      if (url.toString().includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('createCategory')) {
          categoryCreated = true;
          expect(body.variables?.input?.name).toBe('Bebidas Calientes');
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createCategory: {
                  id: 'cat-new-1',
                  name: 'Bebidas Calientes',
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: categoryCreated
                ? [{ id: 'cat-new-1', name: 'Bebidas Calientes' }]
                : [{ id: 'cat-0', name: 'General' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    global.fetch = fetchMock as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
      });

      const openCatModalBtn = screen.getByRole('button', { name: /nueva categoría/i });
      fireEvent.click(openCatModalBtn);

      fireEvent.change(screen.getByLabelText(/nombre de la categoría/i), {
        target: { value: 'Bebidas Calientes' },
      });

      const saveCatBtn = screen.getByRole('button', { name: /guardar categoría/i });
      fireEvent.click(saveCatBtn);

      await waitFor(() => {
        expect(categoryCreated).toBe(true);
        expect(screen.getByText('Bebidas Calientes')).toBeInTheDocument();
        expect(screen.getByText('Nueva Categoría Creada')).toBeInTheDocument();
        expect(screen.queryByText('Nuevo Producto Creado')).not.toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Muestra Skeleton de carga inicial mientras se obtienen los datos del menú', async () => {
    let resolveQuery: any;
    const fetchPromise = new Promise((resolve) => {
      resolveQuery = resolve;
    });
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => fetchPromise) as any;

    try {
      render(<MenuPage />);
      expect(screen.getByTestId('menu-loading-skeleton')).toBeInTheDocument();

      resolveQuery({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          data: {
            categories: [{ id: 'cat-1', name: 'Pastas' }],
            products: [],
          },
        }),
      });

      await waitFor(() => {
        expect(screen.queryByTestId('menu-loading-skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('Pastas')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Renderiza los productos usando ProductCard real con KpiValue y AvailabilityToggle funcional', async () => {
    let setAvailabilityCalled = false;
    let toggledId = '';
    let toggledVal: boolean | null = null;

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.query?.includes('setProductAvailability')) {
        setAvailabilityCalled = true;
        toggledId = body.variables?.id;
        toggledVal = body.variables?.isAvailable;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              setProductAvailability: {
                id: toggledId,
                isAvailable: toggledVal,
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          data: {
            categories: [{ id: 'cat-1', name: 'Pastas' }],
            products: [
              {
                id: 'prod-10',
                name: 'Spaghetti Carbonara',
                price: 28000,
                isAvailable: true,
                category: { id: 'cat-1' },
              },
            ],
          },
        }),
      };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Spaghetti Carbonara')).toBeInTheDocument();
      });

      // Precio renderizado con KpiValue (formatCOP)
      expect(screen.getByText(/\$\s*28\.000/)).toBeInTheDocument();

      // AvailabilityToggle con role="switch"
      const toggle = screen.getByRole('switch', { name: /disponible/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(setAvailabilityCalled).toBe(true);
        expect(toggledId).toBe('prod-10');
        expect(toggledVal).toBe(false);
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('Renderiza las categorías usando CategoryCard con contador de platos', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        data: {
          categories: [{ id: 'cat-1', name: 'Postres' }],
          products: [
            { id: 'p-1', name: 'Flan', price: 5, isAvailable: true, category: { id: 'cat-1' } },
            { id: 'p-2', name: 'Helado', price: 4, isAvailable: true, category: { id: 'cat-1' } },
          ],
        },
      }),
    })) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Postres')).toBeInTheDocument();
        expect(screen.getByText('2 platos')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('H5 & H3: Toast de éxito muestra copia según acción ("Nueva Categoría Creada" vs "Nuevo Producto Creado") y ningún botón usa warning/amber', async () => {
    let categoryCreated = false;
    let productCreated = false;

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('createCategory')) {
          categoryCreated = true;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createCategory: { id: 'cat-new-2', name: 'Entradas Frías' },
              },
            }),
          };
        }
        if (body.query?.includes('createProduct')) {
          productCreated = true;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createProduct: {
                  id: 'prod-new-1',
                  name: 'Ceviche',
                  price: 850,
                  isAvailable: true,
                  category: { id: 'cat-1' },
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Entradas' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Entradas')).toBeInTheDocument();
      });

      // 1. Crear categoría -> Toast 'Nueva Categoría Creada'
      const openCatBtn = screen.getByRole('button', { name: /nueva categoría/i });
      fireEvent.click(openCatBtn);

      fireEvent.change(screen.getByLabelText(/nombre de la categoría/i), {
        target: { value: 'Entradas Frías' },
      });
      const saveCatBtn = screen.getByRole('button', { name: /guardar categoría/i });
      fireEvent.click(saveCatBtn);

      await waitFor(() => {
        expect(categoryCreated).toBe(true);
        expect(screen.getByText('Nueva Categoría Creada')).toBeInTheDocument();
      });

      // 2. Crear producto -> Toast 'Nuevo Producto Creado'
      const openProdBtn = screen.getByRole('button', { name: /nuevo producto/i });
      fireEvent.click(openProdBtn);

      fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Ceviche' } });
      fireEvent.change(screen.getByLabelText(/^precio/i), { target: { value: '850' } });
      const saveProdBtn = screen.getByRole('button', { name: /crear producto|guardar plato|guardar producto|guardar/i });
      fireEvent.click(saveProdBtn);

      await waitFor(() => {
        expect(productCreated).toBe(true);
        expect(screen.getByText('Nuevo Producto Creado')).toBeInTheDocument();
      });

      // 3. Barrido: ningún botón usa colores warning ni amber
      const allButtons = screen.getAllByRole('button');
      for (const btn of allButtons) {
        const styleAttr = btn.getAttribute('style') || '';
        expect(styleAttr).not.toContain('var(--bento-warning)');
        expect(styleAttr).not.toContain('var(--bento-amber)');
      }

      // Verificación directa en el código fuente
      const fs = require('fs');
      const path = require('path');
      const menuSource = fs.readFileSync(path.resolve(__dirname, '../src/app/(panel)/menu/page.tsx'), 'utf-8');
      expect(menuSource).not.toContain('var(--bento-warning)');
      expect(menuSource).not.toContain('var(--bento-amber)');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('REF-6 & N05: Crear producto completo con nombre, precio COP, prepTimeMinutes, descripción e imagen', async () => {
    let createProductCalledWith: any = null;
    const originalFetch = global.fetch;

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/uploads')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({ url: '/uploads/ajiaco.webp' }),
        };
      }
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('createProduct')) {
          createProductCalledWith = body.variables?.input;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createProduct: {
                  id: 'prod-ajiaco-1',
                  name: body.variables.input.name,
                  price: body.variables.input.price,
                  isAvailable: true,
                  prepTimeMinutes: body.variables.input.prepTimeMinutes,
                  description: body.variables.input.description,
                  imageUrl: body.variables.input.imageUrl,
                  category: { id: 'cat-1' },
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Platos Típicos' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Platos Típicos')).toBeInTheDocument();
      });

      const openProdBtn = screen.getByRole('button', { name: /nuevo producto/i });
      fireEvent.click(openProdBtn);

      fireEvent.change(screen.getByLabelText(/nombre del producto/i), {
        target: { value: 'Ajiaco Santafereño' },
      });
      fireEvent.change(screen.getByLabelText(/precio en cop/i), {
        target: { value: '32000' },
      });
      fireEvent.change(screen.getByLabelText(/tiempo prep/i), {
        target: { value: '25' },
      });
      fireEvent.change(screen.getByLabelText(/descripción/i), {
        target: { value: 'Sopa tradicional con pollo y tres tipos de papa' },
      });

      const file = new File(['dummy-image-bytes'], 'ajiaco.png', { type: 'image/png' });
      const fileInput = screen.getByLabelText(/imagen del plato/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        const preview = screen.getByAltText(/vista previa de imagen/i);
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', '/uploads/ajiaco.webp');
      });

      const saveBtn = screen.getByRole('button', { name: /crear producto/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(createProductCalledWith).toBeDefined();
        expect(createProductCalledWith.name).toBe('Ajiaco Santafereño');
        expect(createProductCalledWith.price).toBe(32000);
        expect(createProductCalledWith.prepTimeMinutes).toBe(25);
        expect(createProductCalledWith.description).toBe('Sopa tradicional con pollo y tres tipos de papa');
        expect(createProductCalledWith.imageUrl).toBe('/uploads/ajiaco.webp');
        expect(screen.getByText('Nuevo Producto Creado')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('N12: Toggle de disponibilidad guarda isAvailable: false/true al crear producto con checkbox desmarcado', async () => {
    let setAvailabilityCalled = false;
    let availabilityVal: boolean | null = null;
    const originalFetch = global.fetch;

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('createProduct')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                createProduct: {
                  id: 'prod-agotado-1',
                  name: 'Jugo Natural',
                  price: 8000,
                  isAvailable: true,
                  category: { id: 'cat-1' },
                },
              },
            }),
          };
        }
        if (body.query?.includes('setProductAvailability')) {
          setAvailabilityCalled = true;
          availabilityVal = body.variables?.isAvailable;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                setProductAvailability: {
                  id: body.variables.id,
                  isAvailable: body.variables.isAvailable,
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Bebidas' }],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Bebidas')).toBeInTheDocument();
      });

      const openProdBtn = screen.getByRole('button', { name: /nuevo producto/i });
      fireEvent.click(openProdBtn);

      fireEvent.change(screen.getByLabelText(/nombre del producto/i), { target: { value: 'Jugo Natural' } });
      fireEvent.change(screen.getByLabelText(/precio en cop/i), { target: { value: '8000' } });

      const availCheckbox = screen.getByLabelText(/disponible para ordenar/i);
      expect(availCheckbox).toBeChecked();
      fireEvent.click(availCheckbox);
      expect(availCheckbox).not.toBeChecked();

      const saveBtn = screen.getByRole('button', { name: /crear producto/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(setAvailabilityCalled).toBe(true);
        expect(availabilityVal).toBe(false);
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('N11: Reordenar categorías con botones Subir y Bajar llama a updateCategory con nuevo sortOrder', async () => {
    const updatedCategories: any[] = [];
    const originalFetch = global.fetch;

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('updateCategory')) {
          updatedCategories.push({
            id: body.variables?.id,
            input: body.variables?.input,
          });
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: {
                updateCategory: {
                  id: body.variables.id,
                  name: 'Actualizada',
                  sortOrder: body.variables.input?.sortOrder,
                },
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-1', name: 'Entradas', sortOrder: 0 },
                { id: 'cat-2', name: 'Fuertes', sortOrder: 1 },
              ],
              products: [],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Entradas')).toBeInTheDocument();
        expect(screen.getByText('Fuertes')).toBeInTheDocument();
      });

      const subirFuertesBtn = screen.getByRole('button', { name: /subir categoría fuertes/i });
      expect(subirFuertesBtn).toBeEnabled();
      fireEvent.click(subirFuertesBtn);

      await waitFor(() => {
        expect(updatedCategories.length).toBeGreaterThanOrEqual(2);
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('N10: Menú es SOLO MENÚ — ausencia total de elementos o links de mesas y QR en /menu', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        data: {
          categories: [{ id: 'cat-1', name: 'Postres' }],
          products: [],
        },
      }),
    })) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Postres')).toBeInTheDocument();
      });

      // No debe existir ningún link ni texto de gestión de mesas o QR
      expect(screen.queryByText(/gestión de mesas/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/código qr|rotar qr|código de mesa/i)).not.toBeInTheDocument();

      const allLinks = screen.queryAllByRole('link');
      for (const link of allLinks) {
        expect(link.getAttribute('href')).not.toMatch(/mesas|qr/i);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('REF-6 & N11: Eliminar producto con confirmación ejecuta mutación deleteProduct', async () => {
    let deleteProductCalledId = '';
    const originalFetch = global.fetch;
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/graphql')) {
        const body = JSON.parse(opts.body);
        if (body.query?.includes('deleteProduct')) {
          deleteProductCalledId = body.variables?.id;
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              data: { deleteProduct: true },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [{ id: 'cat-1', name: 'Pizzas' }],
              products: [
                {
                  id: 'prod-to-delete',
                  name: 'Pizza Hawaiana',
                  price: 24000,
                  isAvailable: true,
                  category: { id: 'cat-1' },
                },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as any;

    try {
      render(<MenuPage />);
      await waitFor(() => {
        expect(screen.getByText('Pizza Hawaiana')).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole('button', { name: /eliminar pizza hawaiana/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(deleteProductCalledId).toBe('prod-to-delete');
        expect(screen.getByText('Producto Eliminado')).toBeInTheDocument();
      });
    } finally {
      global.fetch = originalFetch;
      window.confirm = originalConfirm;
    }
  });
});

