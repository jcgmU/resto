import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from './setup';
import { PwaApiClient } from '../src/lib/api';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import { ModifierGroupPicker } from '../src/components/ModifierGroupPicker';

describe('U17: Modificadores completos en PWA (MSW & TDD)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = 'guest-token-test';
    PwaApiClient.session = { sessionId: 'sess-1', tenantId: 'tenant-u17', tableId: 't-1' };
    server.resetHandlers();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  test('U17.1 (Defensivo): ModifierGroupPicker no crashea si group.options es undefined o null', () => {
    const brokenGroup: any = {
      id: 'mg-broken',
      name: 'Grupo sin opciones',
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      options: undefined,
    };

    expect(() => {
      render(<ModifierGroupPicker group={brokenGroup} />);
    }).not.toThrow();

    expect(screen.getByText('Grupo sin opciones')).toBeInTheDocument();
  });

  test('U17.2: fetchMenu solicita campos completos de modifierGroups en la query GraphQL GetMenu y asegura que options sea array', async () => {
    let capturedQuery = '';

    server.use((url: string, options: any) => {
      if (url.includes('/graphql') && options?.method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        capturedQuery = body.query || '';

        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-burgers', name: 'Hamburguesas', sortOrder: 0, isActive: true },
              ],
              products: [
                {
                  id: 'prod-burger-1',
                  name: 'Bento Burger Clásica',
                  price: 12.0,
                  isAvailable: true,
                  imageUrl: '/bento-burger.jpg',
                  sortOrder: 0,
                  category: { id: 'cat-burgers' },
                  modifierGroups: [
                    {
                      id: 'mg-carne',
                      name: 'Término de la carne',
                      minSelections: 1,
                      maxSelections: 1,
                      isRequired: true,
                      options: [
                        { id: 'opt-jugoso', name: 'Término Jugoso', priceDelta: 0, isDefault: true },
                        { id: 'opt-cocido', name: 'Bien Cocido', priceDelta: 0, isDefault: false },
                      ],
                    },
                    {
                      id: 'mg-empty-opts',
                      name: 'Grupo sin opciones en DB',
                      minSelections: 0,
                      maxSelections: 1,
                      isRequired: false,
                      options: null,
                    },
                  ],
                },
              ],
            },
          }),
        };
      }
      return undefined;
    });

    const menu = await PwaApiClient.fetchMenu('tenant-u17');

    // Verificar que la query GraphQL incluye los campos requeridos
    expect(capturedQuery).toContain('minSelections');
    expect(capturedQuery).toContain('maxSelections');
    expect(capturedQuery).toContain('isRequired');
    expect(capturedQuery).toContain('priceDelta');
    expect(capturedQuery).toContain('isDefault');

    // Mapeo asegurado
    const product = menu.products[0];
    expect(product.modifierGroups).toHaveLength(2);
    expect(product.modifierGroups![0].options).toHaveLength(2);
    expect(Array.isArray(product.modifierGroups![1].options)).toBe(true);
    expect(product.modifierGroups![1].options).toEqual([]);
  });

  test('U17.3: ProductDetailSheet con datos reales de MSW: renderiza sin crash, bloquea Añadir si falta obligatorio y permite añadir al satisfacerlo', async () => {
    server.use((url: string, options: any) => {
      if (url.includes('/graphql') && options?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: {
              categories: [
                { id: 'cat-platos', name: 'Platos', sortOrder: 0, isActive: true },
              ],
              products: [
                {
                  id: 'prod-combo',
                  name: 'Combo Especial Bento',
                  price: 18.5,
                  isAvailable: true,
                  imageUrl: '/combo.jpg',
                  sortOrder: 0,
                  category: { id: 'cat-platos' },
                  modifierGroups: [
                    {
                      id: 'mg-acomp',
                      name: 'Acompañamiento',
                      minSelections: 1,
                      maxSelections: 1,
                      isRequired: true,
                      options: [
                        { id: 'opt-papas', name: 'Papas Rústicas', priceDelta: 0, isDefault: false },
                        { id: 'opt-ensalada', name: 'Ensalada César', priceDelta: 3500, isDefault: false },
                      ],
                    },
                  ],
                },
              ],
            },
          }),
        };
      }
      return undefined;
    });

    const menu = await PwaApiClient.fetchMenu('tenant-u17');
    const product = menu.products[0];

    const onAddToCart = jest.fn();
    const onClose = jest.fn();

    // (a) Renderiza en ProductDetailSheet sin crash y muestra las opciones y grupo obligatorio
    const { rerender } = render(
      <ProductDetailSheet
        product={product}
        isOpen={true}
        onClose={onClose}
        onAddToCart={onAddToCart}
      />
    );

    expect(screen.getByText('Combo Especial Bento')).toBeInTheDocument();
    expect(screen.getByText(/Acompañamiento/i)).toBeInTheDocument();
    expect(screen.getByText('(Obligatorio)')).toBeInTheDocument();
    expect(screen.getByText('Papas Rústicas')).toBeInTheDocument();
    expect(screen.getByText('Ensalada César')).toBeInTheDocument();
    expect(screen.getByText(/\(\+\s*\$\s*3\.500\)/)).toBeInTheDocument();

    // (b) Botón "Añadir al carrito" queda bloqueado/inválido hasta satisfacer el mínimo requerido
    const addBtn = screen.getByRole('button', { name: /añadir al carrito/i });
    expect(addBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Selecciona las opciones obligatorias/i);

    // Intentar clickear mientras está bloqueado no debe disparar onAddToCart
    fireEvent.click(addBtn);
    expect(onAddToCart).not.toHaveBeenCalled();

    // (c) Al seleccionar la opción requerida, permite añadir al carrito con modificadores
    const optionCheckbox = screen.getByLabelText('Papas Rústicas');
    fireEvent.click(optionCheckbox);

    // Ahora debe estar habilitado y sin mensaje de alerta
    expect(addBtn).not.toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Click en añadir al carrito
    fireEvent.click(addBtn);

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod-combo', name: 'Combo Especial Bento' }),
      [
        {
          groupId: 'mg-acomp',
          groupName: 'Acompañamiento',
          optionId: 'opt-papas',
          optionName: 'Papas Rústicas',
          priceDelta: 0,
        },
      ],
      1
    );
    expect(onClose).toHaveBeenCalled();
  });
});
