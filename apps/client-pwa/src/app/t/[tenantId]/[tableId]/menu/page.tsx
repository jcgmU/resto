"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PwaApiClient, MenuResult } from '../../../../../lib/api';
import { GuestSessionGuard } from '../../../../../components/GuestSessionGuard';
import { ProductListCard } from '../../../../../components/ProductListCard';
import { ProductDetailSheet } from '../../../../../components/ProductDetailSheet';
import { CartFab, CartSheet, OrderConfirmationCard } from '../../../../../components/cart';
import {
  BentoGrid,
  BentoCard,
  FeatureGuard,
  TabsPill,
  TabsPillItem,
  Skeleton,
  EmptyState,
  ErrorState,
  StatusChip,
} from '@packages/ui-components';
import { ProductDTO, CategoryDTO, CartDTO } from '@packages/shared-types';

export interface ClientMenuPageProps {
  params: {
    tenantId: string;
    tableId: string;
  };
}

const ALL_CATEGORIES_ID = 'all';

export default function ClientMenuPage({ params }: ClientMenuPageProps) {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES_ID);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);
  const [billRequested, setBillRequested] = useState<boolean>(false);
  const [requestingBill, setRequestingBill] = useState<boolean>(false);
  const [billError, setBillError] = useState<string | null>(null);

  // Estados completos de carga y error del menú
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    try {
      const currentCart = await PwaApiClient.getCart();
      setCart(currentCart);
    } catch {
      // Ignorar error silencioso de carrito vacío
    }
  }, []);

  const loadMenu = useCallback(async () => {
    if (!PwaApiClient.guestToken) {
      setLoadingMenu(false);
      return;
    }

    setLoadingMenu(true);
    setMenuError(null);

    return PwaApiClient.fetchMenu(params.tenantId)
      .then((res: MenuResult) => {
        setCategories(res.categories || []);
        setProducts(res.products || []);
      })
      .catch((err: any) => {
        setMenuError(err.message || 'Error al cargar el menú. Por favor, reintenta.');
      })
      .finally(() => {
        setLoadingMenu(false);
      });
  }, [params.tenantId]);

  useEffect(() => {
    if (!PwaApiClient.guestToken) {
      setLoadingMenu(false);
      return;
    }

    void loadMenu();
    void refreshCart();
  }, [loadMenu, refreshCart]);

  // Polling silencioso cada ~5s del carrito
  useEffect(() => {
    if (!PwaApiClient.guestToken) {
      return;
    }

    const intervalId = setInterval(() => {
      refreshCart();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshCart]);

  const handleUpdateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await handleRemoveItem(cartItemId);
      return;
    }
    try {
      setCartError(null);
      const updatedCart = await PwaApiClient.updateCartItemQuantity(cartItemId, quantity);
      setCart(updatedCart);
    } catch (err: any) {
      setCartError(err.message || 'Error al actualizar cantidad');
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    try {
      setCartError(null);
      const updatedCart = await PwaApiClient.removeCartItem(cartItemId);
      setCart(updatedCart);
    } catch (err: any) {
      setCartError(err.message || 'Error al eliminar item');
    }
  };

  const handleAddToCart = async (product: ProductDTO, modifiers: any[], quantity: number) => {
    try {
      setCartError(null);
      const modifierNames = (modifiers || []).map((m: any) => m.optionName || m.name).filter(Boolean);
      const updatedCart = await PwaApiClient.addToCart({
        productId: product.id,
        quantity,
        modifiers,
        display: {
          productName: product.name,
          unitPrice: product.price,
          modifierNames,
        },
      });
      setCart(updatedCart);
    } catch (err: any) {
      setCartError(err.message || 'Error al agregar item');
    }
  };

  const handleConfirmOrder = async () => {
    try {
      setIsConfirming(true);
      setCartError(null);
      const order = await PwaApiClient.confirmOrder(params.tableId);
      setConfirmedOrder(order);
      setIsCartOpen(false);
      await refreshCart();
    } catch (err: any) {
      setCartError(err.message || 'Error al confirmar pedido');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRequestBill = async () => {
    try {
      setRequestingBill(true);
      setBillError(null);
      await PwaApiClient.requestBill(params.tableId);
      setBillRequested(true);
    } catch (err: any) {
      setBillError(err.message || 'Error al solicitar la cuenta');
    } finally {
      setRequestingBill(false);
    }
  };

  const handleGuestCheckout = async () => {
    if (!PwaApiClient.session?.sessionId) return;
    try {
      await PwaApiClient.checkout({
        sessionId: PwaApiClient.session.sessionId,
        tableId: params.tableId,
        method: 'CASH',
      });
    } catch {
      // Ignorar error transitorio en modo guest
    }
  };

  const totalItemsCount = (cart?.items || []).reduce((acc, it) => acc + it.quantity, 0);

  // Helper para resolver la categoría de un producto tanto si viene como categoryId o como objeto anidado category
  const getProductCategoryId = useCallback((p: ProductDTO): string | undefined => {
    return p.categoryId || (p as any).category?.id;
  }, []);

  // Tabs de categorías con conteo y opción 'Todas'
  const categoryTabs: TabsPillItem[] = useMemo(() => {
    if (categories.length === 0) {
      return [];
    }
    return [
      { id: ALL_CATEGORIES_ID, label: 'Todas', count: products.length },
      ...categories.map((c) => ({
        id: c.id,
        label: c.name,
        count: products.filter((p) => getProductCategoryId(p) === c.id).length,
      })),
    ];
  }, [categories, products, getProductCategoryId]);

  // Filtrado reactivo de productos
  const filteredProducts = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES_ID) {
      return products;
    }
    return products.filter((p) => getProductCategoryId(p) === selectedCategory);
  }, [products, selectedCategory, getProductCategoryId]);

  return (
    <GuestSessionGuard>
      <main
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: 'var(--bento-spacing-md, 16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--bento-spacing-md, 16px)',
          minHeight: '100vh',
          backgroundColor: 'var(--bento-hueso)',
          paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {confirmedOrder && (
          <div style={{ width: '100%', boxSizing: 'border-box', marginBottom: 'var(--bento-spacing-sm, 8px)' }}>
            <OrderConfirmationCard
              order={confirmedOrder}
              onOrderUpdate={(updated) => setConfirmedOrder(updated)}
            />
          </div>
        )}

        {billRequested && (
          <div
            role="status"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-papel)',
              border: '1px solid var(--bento-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--bento-text)',
              fontWeight: 700,
              textAlign: 'center',
              boxShadow: 'var(--bento-card-shadow)',
              fontFamily: 'var(--bento-font-body)',
            }}
          >
            <div data-testid="bill-status-chip">
              <StatusChip label="Cuenta solicitada" tone="ok" />
            </div>
            <span>La cuenta fue solicitada, un mesero pasará por tu mesa.</span>
          </div>
        )}

        {billError && (
          <div
            role="alert"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-papel)',
              border: '1px solid var(--bento-destructive)',
              color: 'var(--bento-destructive)',
              fontWeight: 600,
              textAlign: 'center',
              fontFamily: 'var(--bento-font-body)',
            }}
          >
            {billError}
          </div>
        )}

        {/* Estados de error, carga, vacío y catálogo */}
        {menuError ? (
          <section aria-label="Error al cargar menú">
            <ErrorState
              title="No pudimos cargar el menú"
              message={menuError}
              onRetry={loadMenu}
              retryLabel="Reintentar"
            />
          </section>
        ) : (
          <>
            {loadingMenu ? (
              <div
                data-testid="menu-loading"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                }}
              >
                <Skeleton width="80px" height="36px" radius="var(--bento-pill-radius)" />
                <Skeleton width="100px" height="36px" radius="var(--bento-pill-radius)" />
                <Skeleton width="90px" height="36px" radius="var(--bento-pill-radius)" />
              </div>
            ) : categoryTabs.length > 0 ? (
              <header
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                }}
              >
                <TabsPill
                  tabs={categoryTabs}
                  value={selectedCategory}
                  onChange={(id) => setSelectedCategory(id)}
                  ariaLabel="Categorías"
                />
              </header>
            ) : null}

            <section
              aria-label="Catálogo"
              style={{
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {loadingMenu ? (
                <BentoGrid cols={2} style={{ width: '100%', boxSizing: 'border-box' }}>
                  {[1, 2, 3, 4].map((n) => (
                    <BentoCard
                      key={n}
                      style={{
                        backgroundColor: 'var(--bento-papel)',
                        padding: 'var(--bento-spacing-md, 16px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <Skeleton width="100%" height="90px" radius="var(--bento-inner-radius)" />
                      <Skeleton width="75%" height="18px" radius="4px" />
                      <Skeleton width="45%" height="16px" radius="4px" />
                    </BentoCard>
                  ))}
                </BentoGrid>
              ) : products.length === 0 ? (
                <EmptyState
                  title="No hay platos disponibles"
                  description="En este momento no hay productos en la carta."
                />
              ) : filteredProducts.length === 0 ? (
                <EmptyState
                  title="No hay platos en esta categoría"
                  description="Prueba seleccionando otra categoría para ver más opciones."
                  action={
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(ALL_CATEGORIES_ID)}
                      style={{
                        minHeight: 'var(--bento-touch-target)',
                        padding: '0 16px',
                        borderRadius: 'var(--bento-pill-radius)',
                        backgroundColor: 'var(--bento-tinta)',
                        color: 'var(--bento-papel)',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--bento-font-body)',
                      }}
                    >
                      Ver todos los platos
                    </button>
                  }
                />
              ) : (
                <BentoGrid cols={2} style={{ width: '100%', boxSizing: 'border-box' }}>
                  {filteredProducts.map((p) => (
                    <ProductListCard
                      key={p.id}
                      product={p}
                      onSelect={() => setSelectedProduct(p)}
                    />
                  ))}
                </BentoGrid>
              )}
            </section>
          </>
        )}

        <footer
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 30,
            boxSizing: 'border-box',
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'var(--bento-hueso)',
            borderTop: '1px solid var(--bento-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* B7: Pedir la cuenta con estados solicitando / solicitada / error */}
          <section aria-label="Cuenta" style={{ width: '100%', boxSizing: 'border-box' }}>
            {!billRequested && (
              <button
                type="button"
                onClick={handleRequestBill}
                disabled={requestingBill}
                style={{
                  minHeight: 'var(--bento-touch-target, 44px)',
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  border: '1px solid var(--bento-tinta)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  cursor: requestingBill ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                {requestingBill ? 'Solicitando cuenta...' : 'Pedir la cuenta'}
              </button>
            )}
          </section>

          {/* B8: Pago guest tras FeatureGuard payments */}
          <section aria-label="Pago" style={{ width: '100%', boxSizing: 'border-box' }}>
            <FeatureGuard flag="payments">
              <button
                type="button"
                onClick={handleGuestCheckout}
                style={{
                  minHeight: 'var(--bento-touch-target, 44px)',
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bento-lima)',
                  color: 'var(--bento-tinta)',
                  border: '1px solid var(--bento-tinta)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                Pagar
              </button>
            </FeatureGuard>
          </section>
        </footer>

        <ProductDetailSheet
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />

        <CartFab
          itemCount={totalItemsCount}
          onClick={() => setIsCartOpen(true)}
        />

        <CartSheet
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onConfirm={handleConfirmOrder}
          error={cartError}
          isConfirming={isConfirming}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />
      </main>
    </GuestSessionGuard>
  );
}
