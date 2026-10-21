import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ClientMenuPage from '../src/app/t/[tenantId]/[tableId]/menu/page';
import { ProductListCard } from '../src/components/ProductListCard';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import { CartSheet } from '../src/components/cart/CartSheet';
import { CartSummaryBar } from '../src/components/cart/CartSummaryBar';
import { PwaApiClient } from '../src/lib/api';
import { formatCOP, ProductDTO } from '@packages/shared-types';

describe('V24: PWA FASE B (Notas, Llamadas con tipo, Modo Waiter-Only e Imágenes)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    act(() => {
      PwaApiClient.clearAuth();
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    sessionStorage.clear();
    act(() => {
      PwaApiClient.clearAuth();
    });
  });

  describe('1. Notas por Ítem y Notas Generales (REF-4)', () => {
    test('ProductDetailSheet incluye campo de "Instrucciones de preparación" y lo envía al añadir al carrito', () => {
      const onAddToCart = jest.fn();
      const product: ProductDTO = {
        id: 'prod-tacos',
        name: 'Tacos al Pastor',
        price: 18000,
        categoryId: 'cat-1',
        isAvailable: true,
        sortOrder: 1,
        tenantId: 'tenant-1',
      };

      render(
        <ProductDetailSheet
          isOpen={true}
          product={product}
          onClose={() => {}}
          onAddToCart={onAddToCart}
        />
      );

      const notesInput = screen.getByPlaceholderText(/instrucciones de preparación/i);
      expect(notesInput).toBeInTheDocument();
      fireEvent.change(notesInput, { target: { value: 'Sin cebolla y salsa aparte' } });

      const addBtn = screen.getByRole('button', { name: /añadir al carrito/i });
      fireEvent.click(addBtn);

      expect(onAddToCart).toHaveBeenCalledTimes(1);
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tacos al Pastor' }),
        [],
        1,
        'Sin cebolla y salsa aparte'
      );
    });

    test('CartSheet incluye textarea para "Otras solicitudes" generales (máx 280 chars) y las envía en onConfirm', async () => {
      const onConfirm = jest.fn().mockResolvedValue(undefined);

      render(
        <CartSheet
          isOpen={true}
          onClose={() => {}}
          cart={{
            tenantId: 't-1',
            sessionId: 's-1',
            total: 35000,
            items: [
              {
                cartItemId: 'item-1',
                productId: 'prod-tacos',
                productName: 'Tacos al Pastor',
                unitPrice: 18000,
                quantity: 1,
                notes: 'Sin cebolla',
                modifiers: [],
                addedAt: new Date().toISOString(),
                lineTotal: 18000,
              },
            ],
          }}
          onConfirm={onConfirm}
        />
      );

      // Verificamos visualización de la nota del ítem en CartLineItem
      expect(screen.getByTestId('cart-item-notes')).toHaveTextContent(/Sin cebolla/);

      // Verificamos textarea de notas generales
      const generalNotes = screen.getByTestId('cart-general-notes-textarea') as HTMLTextAreaElement;
      expect(generalNotes).toBeInTheDocument();
      expect(generalNotes.maxLength).toBe(280);

      fireEvent.change(generalNotes, {
        target: { value: 'Por favor traer platos adicionales y servilletas extra' },
      });

      const confirmBtn = screen.getByRole('button', { name: /enviar pedido/i });
      fireEvent.click(confirmBtn);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('Por favor traer platos adicionales y servilletas extra');
    });

    test('PwaApiClient.confirmOrder envía tanto tableId como notes en el cuerpo POST /v1/cart/confirm', async () => {
      let capturedBody: any = null;
      let capturedUrl: string = '';

      PwaApiClient.guestToken = 'test-token';
      global.fetch = jest.fn(async (url: any, opts: any) => {
        capturedUrl = url.toString();
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'ord-123', status: 'PLACED', notes: capturedBody.notes }),
        };
      });

      const result = await PwaApiClient.confirmOrder({
        tableId: 'mesa-5',
        notes: 'Pedido urgente, tenemos prisa',
      });

      expect(capturedUrl).toContain('/v1/cart/confirm');
      expect(capturedBody).toEqual({
        tableId: 'mesa-5',
        notes: 'Pedido urgente, tenemos prisa',
      });
      expect(result.id).toBe('ord-123');
    });
  });

  describe('2. Botón de Confirmación con formatCOP entero (REF-4, N06)', () => {
    test('CartSummaryBar formatea el total con formatCOP en el botón Enviar Pedido', () => {
      render(<CartSummaryBar total={45000} isConfirming={false} />);
      const btn = screen.getByRole('button', { name: /enviar pedido/i });
      expect(btn.textContent?.replace(/\u00a0/g, ' ')).toBe(`Enviar Pedido • ${formatCOP(45000).replace(/\u00a0/g, ' ')}`);
      expect(btn).toHaveTextContent(/Enviar Pedido • .*45\.000/);
    });

    test('CartSheet renderiza el botón de confirmación con formatCOP(cart.total)', () => {
      render(
        <CartSheet
          isOpen={true}
          onClose={() => {}}
          cart={{
            tenantId: 't-1',
            sessionId: 's-1',
            total: 28500,
            items: [
              {
                cartItemId: 'item-1',
                productId: 'p-1',
                productName: 'Arepa de Choclo',
                unitPrice: 28500,
                quantity: 1,
                modifiers: [],
                addedAt: new Date().toISOString(),
                lineTotal: 28500,
              },
            ],
          }}
        />
      );

      const btn = screen.getByRole('button', { name: /enviar pedido/i });
      expect(btn.textContent?.replace(/\u00a0/g, ' ')).toBe(`Enviar Pedido • ${formatCOP(28500).replace(/\u00a0/g, ' ')}`);
      expect(btn).toHaveTextContent(/Enviar Pedido • .*28\.500/);
    });
  });

  describe('3. Modo waiter_only en PWA (REF-1)', () => {
    test('Al detectar operatingMode === "waiter_only", muestra la pantalla informativa y desactiva ordenes por celular', async () => {
      PwaApiClient.guestToken = 'token-guest-waiter-only';
      PwaApiClient.session = { sessionId: 'sess-wo-1', tableId: 'tb-3', tenantId: 't-wo', status: 'active' };

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/tenant/settings')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ operatingMode: 'waiter_only' }),
          };
        }
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                categories: [{ id: 'cat-1', name: 'Entradas' }],
                products: [
                  { id: 'prod-1', name: 'Empanadas', price: 15000, categoryId: 'cat-1', isAvailable: true },
                ],
              },
            }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0 }),
          };
        }
        if (urlStr.endsWith('/v1/orders')) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ClientMenuPage params={{ tenantId: 't-wo', tableId: 'tb-3' }} />);

      // Pantalla informativa presente con el copy exacto
      const notice = await screen.findByTestId('waiter-only-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent('El pedido por celular está desactivado. Un mesero tomará su orden.');

      // Abre el producto y verifica que agregar al carrito está deshabilitado
      const productCard = await screen.findByText('Empanadas');
      fireEvent.click(productCard);

      const addBtn = await screen.findByRole('button', { name: /cuenta solicitada|desactivado|no disponible/i });
      expect(addBtn).toBeDisabled();
    });
  });

  describe('4. Llamar al Mesero con Tipo (N15)', () => {
    test('Botón "Llamar al mesero" invoca PwaApiClient.createServiceCall con type: "WAITER_CALL" y feedback visible', async () => {
      PwaApiClient.guestToken = 'token-guest-call';
      PwaApiClient.session = { sessionId: 'sess-call-1', tableId: 'tb-4', tenantId: 't-call', status: 'active' };

      let capturedCallBody: any = null;

      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/tenant/settings')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ operatingMode: 'hybrid' }),
          };
        }
        if (urlStr.includes('/graphql')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { categories: [], products: [] } }),
          };
        }
        if (urlStr.endsWith('/v1/cart')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0 }),
          };
        }
        if (urlStr.endsWith('/v1/orders')) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          };
        }
        if (urlStr.includes('/service-calls') && opts?.method === 'POST') {
          capturedCallBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 201,
            json: async () => ({
              callId: 'call-101',
              type: capturedCallBody.type,
              tableId: capturedCallBody.tableId,
              note: capturedCallBody.note,
              status: 'pending',
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ClientMenuPage params={{ tenantId: 't-call', tableId: 'tb-4' }} />);

      // Escribir nota opcional para el mesero
      const noteInput = await screen.findByTestId('call-waiter-note-input');
      fireEvent.change(noteInput, { target: { value: 'Necesitamos la cuenta y la carta de postres' } });

      const callBtn = screen.getByTestId('call-waiter-btn');
      fireEvent.click(callBtn);

      await waitFor(() => {
        expect(capturedCallBody).not.toBeNull();
      });

      expect(capturedCallBody.type).toBe('WAITER_CALL');
      expect(capturedCallBody.tableId).toBe('tb-4');
      expect(capturedCallBody.note).toBe('Necesitamos la cuenta y la carta de postres');

      // Feedback visible de llamada enviada
      const banner = await screen.findByTestId('waiter-status-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Mesero avisado/i);
    });

    test('H4: call-waiter-note-input cumple con touch-target mínimo de 44px (U8 adapt)', async () => {
      PwaApiClient.guestToken = 'token-guest-call';
      PwaApiClient.session = { sessionId: 'sess-call-1', tableId: 'tb-4', tenantId: 't-call', status: 'active' };
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/tenant/settings')) {
          return { ok: true, status: 200, json: async () => ({ operatingMode: 'hybrid' }) };
        }
        if (urlStr.includes('/graphql')) {
          return { ok: true, status: 200, json: async () => ({ data: { menu: { categories: [], products: [] } } }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ClientMenuPage params={{ tenantId: 't-call', tableId: 'tb-4' }} />);
      const noteInput = await screen.findByTestId('call-waiter-note-input');
      expect(noteInput).toHaveStyle({
        minHeight: 'var(--bento-touch-target, 44px)',
      });
    });
  });

  describe('5. Productos Agotados e Imágenes (REF-6, N05, N12)', () => {
    test('Producto con isAvailable === false NO es clicable, muestra badge "Agotado" y no dispara onSelect', () => {
      const onSelect = jest.fn();
      const productAgotado: ProductDTO = {
        id: 'prod-agotado',
        name: 'Costillas BBQ Especiales',
        price: 36000,
        categoryId: 'cat-carnes',
        isAvailable: false,
        sortOrder: 1,
        tenantId: 't-1',
      };

      render(<ProductListCard product={productAgotado} onSelect={onSelect} />);

      const badge = screen.getByTestId('badge-agotado');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Agotado/);

      // Clic en la tarjeta no debe ejecutar onSelect
      const cardTitle = screen.getByText('Costillas BBQ Especiales');
      fireEvent.click(cardTitle);
      expect(onSelect).not.toHaveBeenCalled();
    });

    test('ProductListCard muestra imageUrl si existe, o fallback neumorfo Suite si no tiene imagen', () => {
      const prodConImagen: ProductDTO = {
        id: 'prod-img',
        name: 'Jugo Natural',
        price: 8000,
        imageUrl: 'https://cdn.resto.test/jugo.webp',
        categoryId: 'cat-bebidas',
        isAvailable: true,
        sortOrder: 1,
        tenantId: 't-1',
      };

      const { rerender } = render(<ProductListCard product={prodConImagen} />);
      const img = screen.getByTestId('product-image');
      expect(img).toHaveAttribute('src', 'https://cdn.resto.test/jugo.webp');

      const prodSinImagen: ProductDTO = {
        id: 'prod-no-img',
        name: 'Agua con Gas',
        price: 5000,
        categoryId: 'cat-bebidas',
        isAvailable: true,
        sortOrder: 2,
        tenantId: 't-1',
      };

      rerender(<ProductListCard product={prodSinImagen} />);
      const fallback = screen.getByTestId('product-image-fallback');
      expect(fallback).toBeInTheDocument();
    });

    test('ProductDetailSheet muestra imageUrl si existe y fallback si no existe', () => {
      const prodConImagen: ProductDTO = {
        id: 'prod-img',
        name: 'Plato Con Foto',
        price: 22000,
        imageUrl: 'https://cdn.resto.test/plato.webp',
        categoryId: 'cat-1',
        isAvailable: true,
        sortOrder: 1,
        tenantId: 't-1',
      };

      const { rerender } = render(
        <ProductDetailSheet isOpen={true} product={prodConImagen} onClose={() => {}} />
      );

      const img = screen.getByTestId('product-detail-image');
      expect(img).toHaveAttribute('src', 'https://cdn.resto.test/plato.webp');

      const prodSinImagen: ProductDTO = {
        id: 'prod-no-img',
        name: 'Plato Sin Foto',
        price: 22000,
        categoryId: 'cat-1',
        isAvailable: true,
        sortOrder: 1,
        tenantId: 't-1',
      };

      rerender(
        <ProductDetailSheet isOpen={true} product={prodSinImagen} onClose={() => {}} />
      );

      const fallback = screen.getByTestId('product-detail-image-fallback');
      expect(fallback).toBeInTheDocument();
    });
  });
});
