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
  TabsPill,
  TabsPillItem,
  Skeleton,
  EmptyState,
  ErrorState,
  StatusChip,
} from '@packages/ui-components';
import { ProductDTO, CategoryDTO, CartDTO, OrderDTO } from '@packages/shared-types';

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
  const [sessionOrders, setSessionOrders] = useState<OrderDTO[]>([]);
  const [operatingMode, setOperatingMode] = useState<string>('hybrid');
  const [waiterCustomNote, setWaiterCustomNote] = useState<string>('');
  const [billRequested, setBillRequested] = useState<boolean>(() => {
    return PwaApiClient.session?.status === 'billRequested';
  });
  const [requestingBill, setRequestingBill] = useState<boolean>(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [waiterCalled, setWaiterCalled] = useState<boolean>(false);
  const [callingWaiter, setCallingWaiter] = useState<boolean>(false);
  const [waiterMessage, setWaiterMessage] = useState<string | null>(null);

  useEffect(() => {
    if (PwaApiClient.session?.status === 'billRequested') {
      setBillRequested(true);
    }
  }, []);

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

  const refreshOrders = useCallback(async () => {
    if (!PwaApiClient.guestToken) {
      return;
    }
    try {
      const orders = await PwaApiClient.getOrders();
      if (Array.isArray(orders)) {
        setSessionOrders(orders);
      }
    } catch {
      // Ignorar error silencioso de red al recuperar órdenes
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
    let isMounted = true;

    if (!PwaApiClient.guestToken) {
      setLoadingMenu(false);
      return;
    }

    setLoadingMenu(true);
    setMenuError(null);

    PwaApiClient.fetchMenu(params.tenantId)
      .then((res: MenuResult) => {
        if (isMounted) {
          setCategories(res.categories || []);
          setProducts(res.products || []);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setMenuError(err.message || 'Error al cargar el menú. Por favor, reintenta.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingMenu(false);
        }
      });

    refreshCart();
    refreshOrders();

    PwaApiClient.getTenantSettings()
      .then((settings) => {
        if (isMounted && settings?.operatingMode) {
          setOperatingMode(settings.operatingMode);
        }
      })
      .catch(() => {
        // Ignorar error y mantener default hybrid
      });

    return () => {
      isMounted = false;
    };
  }, [params.tenantId, refreshCart, refreshOrders]);

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

  const hasOrderInProgress = useMemo(() => {
    const all = [...sessionOrders, ...(confirmedOrder ? [confirmedOrder] : [])];
    return all.some((o) => ['PLACED', 'CONFIRMED', 'IN_KITCHEN'].includes(o.status));
  }, [sessionOrders, confirmedOrder]);

  const handleCallWaiter = async (customNote?: string) => {
    try {
      setCallingWaiter(true);
      await PwaApiClient.createServiceCall({
        type: 'WAITER_CALL',
        tableId: params.tableId,
        note: customNote || undefined,
      });
      setWaiterCalled(true);
      if (hasOrderInProgress) {
        setWaiterMessage('Mesero avisado. Tu pedido sigue en preparación');
      } else {
        setWaiterMessage('Mesero avisado. En breve se acercará a tu mesa');
      }
    } catch (err: any) {
      setWaiterMessage('Error al avisar al mesero. Por favor intenta de nuevo.');
    } finally {
      setCallingWaiter(false);
    }
  };

  const handleAddToCart = async (product: ProductDTO, modifiers: any[], quantity: number, notes?: string) => {
    if (operatingMode === 'waiter_only') {
      setCartError('El pedido por celular está desactivado. Un mesero tomará su orden.');
      return;
    }
    if (billRequested) {
      setCartError('La cuenta ya fue solicitada y no se pueden agregar más pedidos.');
      return;
    }
    try {
      setCartError(null);
      const modifierNames = (modifiers || []).map((m: any) => m.optionName || m.name).filter(Boolean);
      const updatedCart = await PwaApiClient.addToCart({
        productId: product.id,
        quantity,
        modifiers,
        notes,
        display: {
          productName: product.name,
          unitPrice: product.price,
          modifierNames,
        },
      });
      setCart(updatedCart);
    } catch (err: any) {
      if (err.status === 409 || err.code === 'SESSION_NOT_ORDERABLE') {
        setBillRequested(true);
        setCartError('La cuenta ya fue solicitada y no se pueden agregar más pedidos.');
      } else {
        setCartError(err.message || 'Error al agregar item');
      }
    }
  };

  const handleConfirmOrder = async (notes?: string) => {
    if (operatingMode === 'waiter_only') {
      setCartError('El pedido por celular está desactivado. Un mesero tomará su orden.');
      return;
    }
    if (billRequested) {
      setCartError('La cuenta ya fue solicitada y no se pueden agregar más pedidos.');
      return;
    }
    try {
      setIsConfirming(true);
      setCartError(null);
      const order = await PwaApiClient.confirmOrder({ tableId: params.tableId, notes });
      setConfirmedOrder(order);
      setSessionOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      setIsCartOpen(false);
      await refreshCart();
      await refreshOrders();
    } catch (err: any) {
      if (err.status === 409 || err.code === 'SESSION_NOT_ORDERABLE') {
        setBillRequested(true);
        setCartError('La cuenta ya fue solicitada y no se pueden agregar más pedidos.');
      } else {
        setCartError(err.message || 'Error al confirmar pedido');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRequestBill = async () => {
    try {
      setRequestingBill(true);
      setBillError(null);
      await PwaApiClient.requestBill(PwaApiClient.session?.sessionId);
      setBillRequested(true);
    } catch (err: any) {
      setBillError(err.message || 'Error al solicitar la cuenta. Por favor, reintenta.');
    } finally {
      setRequestingBill(false);
    }
  };

  const totalItemsCount = (cart?.items || []).reduce((acc, it) => acc + it.quantity, 0);

  // Helper para resolver la categoría de un producto tanto si viene como categoryId o como objeto anidado category
  const getProductCategoryId = useCallback((p: ProductDTO): string | undefined => {
    return p.categoryId || (p as any).category?.id;
  }, []);

  // Tabs de categorías con conteo y opción 'Todas' (U03)
  const categoryTabs: TabsPillItem[] = useMemo(() => {
    if (categories.length === 0) {
      return [];
    }
    // Si solo existe 1 categoría (categories.length <= 1), ocultar el chip/tab 'Todas'
    if (categories.length <= 1) {
      return categories.map((c) => ({
        id: c.id,
        label: c.name,
        count: products.filter((p) => getProductCategoryId(p) === c.id).length,
      }));
    }
    // Si hay 2 o más categorías, mostrar 'Todas' y las demás pestañas normalmente
    return [
      { id: ALL_CATEGORIES_ID, label: 'Todas', count: products.length },
      ...categories.map((c) => ({
        id: c.id,
        label: c.name,
        count: products.filter((p) => getProductCategoryId(p) === c.id).length,
      })),
    ];
  }, [categories, products, getProductCategoryId]);

  useEffect(() => {
    if (categories.length === 1 && selectedCategory === ALL_CATEGORIES_ID) {
      setSelectedCategory(categories[0].id);
    } else if (categories.length > 1 && selectedCategory !== ALL_CATEGORIES_ID && !categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory(ALL_CATEGORIES_ID);
    }
  }, [categories, selectedCategory]);

  // Filtrado reactivo de productos
  const filteredProducts = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES_ID || categories.length <= 1) {
      return products;
    }
    return products.filter((p) => getProductCategoryId(p) === selectedCategory);
  }, [products, selectedCategory, categories.length, getProductCategoryId]);

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
        <header
          style={{
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '26px',
              lineHeight: 1.25,
              fontFamily: 'var(--bento-font-heading)',
              fontWeight: 700,
              color: 'var(--bento-tinta)',
            }}
          >
            Carta
          </h1>
        </header>

        {/* Modo waiter_only informativo (REF-1) */}
        {operatingMode === 'waiter_only' && (
          <section
            role="status"
            aria-label="Modo solo meseros"
            data-testid="waiter-only-notice"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '24px 16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-papel)',
              border: '1px solid var(--bento-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center',
              boxShadow: 'var(--bento-card-shadow)',
              marginBottom: 'var(--bento-spacing-sm, 8px)',
            }}
          >
            <StatusChip label="Solo Meseros" tone="warning" />
            <h2
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--bento-text)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              El pedido por celular está desactivado. Un mesero tomará su orden.
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bento-text-muted)' }}>
              Puedes explorar la carta, pero la orden debe ser tomada por el personal de sala.
            </p>
          </section>
        )}

        {/* Lista de órdenes de la sesión (U04) */}
        {sessionOrders.length > 0 ? (
          <section
            aria-label="Órdenes de la sesión"
            data-testid="session-orders-list"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--bento-spacing-sm, 8px)',
              marginBottom: 'var(--bento-spacing-sm, 8px)',
            }}
          >
            {sessionOrders.map((ord) => (
              <OrderConfirmationCard
                key={ord.id}
                order={ord}
                onOrderUpdate={(updated) => {
                  setSessionOrders((prev) =>
                    prev.map((o) => (o.id === updated.id ? updated : o))
                  );
                }}
                onAddAnotherOrder={() => {
                  const el = document.getElementById('catalogo-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            ))}
          </section>
        ) : confirmedOrder ? (
          <div style={{ width: '100%', boxSizing: 'border-box', marginBottom: 'var(--bento-spacing-sm, 8px)' }}>
            <OrderConfirmationCard
              order={confirmedOrder}
              onOrderUpdate={(updated) => setConfirmedOrder(updated)}
              onAddAnotherOrder={() => {
                const el = document.getElementById('catalogo-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />
          </div>
        ) : null}

        {waiterMessage && (
          <div
            role="status"
            aria-live="polite"
            data-testid="waiter-status-banner"
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
            <StatusChip label="Mesero avisado" tone="ok" />
            <span>{waiterMessage}</span>
          </div>
        )}

        {billRequested && (
          <div
            role="status"
            aria-live="polite"
            data-testid="bill-status-banner"
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
            <span>Cuenta pedida. Un mesero se acercará con la cuenta</span>
            {hasOrderInProgress && (
              <span data-testid="order-in-progress-notice" style={{ fontSize: '0.9rem', color: 'var(--bento-text-muted)' }}>
                Mesero avisado. Tu pedido sigue en preparación
              </span>
            )}
            <p
              data-testid="bill-blocked-notice"
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--bento-destructive, #c53030)',
                fontWeight: 600,
              }}
            >
              La cuenta ya fue solicitada y no se pueden agregar más pedidos.
            </p>
          </div>
        )}

        {billError && (
          <div
            role="alert"
            data-testid="bill-error-banner"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 16px',
              borderRadius: 'var(--bento-card-radius)',
              backgroundColor: 'var(--bento-papel)',
              border: '1px solid var(--bento-destructive, #c53030)',
              color: 'var(--bento-destructive, #c53030)',
              fontWeight: 600,
              textAlign: 'center',
              fontFamily: 'var(--bento-font-body)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{billError}</span>
            <button
              type="button"
              onClick={handleRequestBill}
              style={{
                minHeight: '36px',
                padding: '0 16px',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'transparent',
                border: '1px solid currentColor',
                color: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              Reintentar
            </button>
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
                <Skeleton width="80px" height="44px" radius="var(--bento-pill-radius)" />
                <Skeleton width="100px" height="44px" radius="var(--bento-pill-radius)" />
                <Skeleton width="90px" height="44px" radius="var(--bento-pill-radius)" />
              </div>
            ) : categoryTabs.length > 0 ? (
              <header
                data-component="category-tabs"
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
              id="catalogo-section"
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
          {/* Acción Llamar al mesero (U03, N15) */}
          <section aria-label="Mesero" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="text"
              placeholder="Mensaje opcional para el mesero..."
              value={waiterCustomNote}
              onChange={(e) => setWaiterCustomNote(e.target.value)}
              aria-label="Mensaje para el mesero"
              data-testid="call-waiter-note-input"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 12px',
                borderRadius: 'var(--bento-pill-radius)',
                border: '1px solid var(--bento-border)',
                background: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                fontSize: '0.85rem',
                fontFamily: 'var(--bento-font-body)',
              }}
            />
            <button
              type="button"
              onClick={() => handleCallWaiter(waiterCustomNote)}
              disabled={callingWaiter}
              data-testid="call-waiter-btn"
              style={{
                minHeight: 'var(--bento-touch-target, 44px)',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                fontWeight: 600,
                cursor: callingWaiter ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--bento-font-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {callingWaiter ? 'Avisando al mesero...' : 'Llamar al mesero'}
            </button>
          </section>

          {/* Acción Pedir la cuenta con estados visibles (R10) */}
          <section aria-label="Cuenta" style={{ width: '100%', boxSizing: 'border-box' }}>
            {billRequested ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                style={{
                  minHeight: 'var(--bento-touch-target, 44px)',
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-text-muted, #718096)',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  cursor: 'default',
                  fontFamily: 'var(--bento-font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>Cuenta pedida</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestBill}
                disabled={requestingBill}
                style={{
                  minHeight: 'var(--bento-touch-target, 44px)',
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: requestingBill ? 'var(--bento-subtle, #f0f0f0)' : 'var(--bento-tinta)',
                  color: requestingBill ? 'var(--bento-text-muted, #718096)' : 'var(--bento-papel)',
                  border: '1px solid var(--bento-tinta)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  cursor: requestingBill ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--bento-font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {requestingBill ? (
                  <>
                    <span
                      aria-hidden="true"
                      data-testid="bill-request-spinner"
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid currentColor',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span>Solicitando cuenta...</span>
                  </>
                ) : (
                  'Pedir la cuenta'
                )}
              </button>
            )}
          </section>
        </footer>

        <ProductDetailSheet
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          isOrderable={!billRequested && operatingMode !== 'waiter_only'}
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
          isOrderable={!billRequested && operatingMode !== 'waiter_only'}
        />
      </main>
    </GuestSessionGuard>
  );
}
