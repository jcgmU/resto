"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BentoCard,
  StatusChip,
  TabsPill,
  PageHeader,
} from '@packages/ui-components';
import { formatCOP, TableDTO, ZoneDTO } from '@packages/shared-types';
import {
  fetchTables,
  fetchZones,
  fetchMenu,
  staffOpenSession,
  addWaiterCartItem,
  confirmWaiterOrder,
  fetchTenantSettings,
  WaiterCategory,
  WaiterProduct,
} from '../../../lib/api/waiter';
import { ApiClient } from '../../../lib/api';

interface EnrichedTable {
  tableId: string;
  label: string;
  capacity: number;
  zoneId?: string;
  zoneName: string;
  status: string;
  effectiveStatus: 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'DESHABILITADA';
  chipTone: 'ok' | 'error' | 'warning' | 'neutral';
}

interface WaiterCartItem {
  tempId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export default function WaiterTerminalPage() {
  const router = useRouter();

  // Pasos: 1 = Seleccionar Mesa, 2 = Agregar Productos, 3 = Revisión y Envío
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Datos base
  const [tables, setTables] = useState<EnrichedTable[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [categories, setCategories] = useState<WaiterCategory[]>([]);
  const [products, setProducts] = useState<WaiterProduct[]>([]);
  const [operatingMode, setOperatingMode] = useState<'hybrid' | 'waiter_only'>('hybrid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del flujo de pedido
  const [selectedTable, setSelectedTable] = useState<EnrichedTable | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectingTableId, setSelectingTableId] = useState<string | null>(null);

  // Menú y filtros
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [itemNotesInput, setItemNotesInput] = useState<Record<string, string>>({});

  // Carrito temporal del mesero
  const [cart, setCart] = useState<WaiterCartItem[]>([]);
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastConfirmedTable, setLastConfirmedTable] = useState<string | null>(null);

  // Carga inicial de datos
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, zonesRes, menuRes, settingsRes, sessionsRes, reservationsRes] =
        await Promise.all([
          fetchTables(),
          fetchZones().catch(() => []),
          fetchMenu().catch(() => ({ categories: [], products: [] })),
          fetchTenantSettings().catch(() => ({ operatingMode: 'hybrid' as const })),
          ApiClient.request('/v1/sessions?status=active').catch(() => []),
          ApiClient.request('/v1/reservations').catch(() => []),
        ]);

      const normalizedZones: ZoneDTO[] = Array.isArray(zonesRes)
        ? zonesRes
        : (zonesRes as any)?.data || [];
      setZones(normalizedZones);

      const activeSessions: any[] = Array.isArray(sessionsRes)
        ? sessionsRes
        : (sessionsRes as any)?.data || [];
      const activeSessionTableIds = new Set(
        activeSessions
          .filter((s) => s.tableId && (s.status === 'active' || !s.status))
          .map((s) => s.tableId)
      );

      const reservations: any[] = Array.isArray(reservationsRes)
        ? reservationsRes
        : (reservationsRes as any)?.data || [];
      const todayReservedTableIds = new Set(
        reservations
          .filter((r) => r.status === 'active')
          .map((r) => r.tableId)
      );

      const rawTables: any[] = Array.isArray(tablesRes)
        ? tablesRes
        : (tablesRes as any)?.data || [];
      const enriched: EnrichedTable[] = rawTables.map((t) => {
        const tableId = t.tableId || t.id;
        const isOccupied = activeSessionTableIds.has(tableId) || t.status === 'OCCUPIED';
        const isReserved =
          !isOccupied && (todayReservedTableIds.has(tableId) || t.status === 'RESERVED');
        const isDisabled = t.status === 'DISABLED' || t.status === 'inactive';

        let effectiveStatus: 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'DESHABILITADA' = 'LIBRE';
        if (isDisabled) effectiveStatus = 'DESHABILITADA';
        else if (isOccupied) effectiveStatus = 'OCUPADA';
        else if (isReserved) effectiveStatus = 'RESERVADA';

        const chipTone: 'ok' | 'error' | 'warning' | 'neutral' =
          effectiveStatus === 'LIBRE'
            ? 'ok'
            : effectiveStatus === 'OCUPADA'
            ? 'error'
            : effectiveStatus === 'RESERVADA'
            ? 'warning'
            : 'neutral';

        const zoneObj = normalizedZones.find((z) => z.id === t.zoneId);
        const zoneName = zoneObj?.name || 'Salón Principal';

        return {
          tableId,
          label: t.label || t.number || tableId,
          capacity: t.capacity ?? 4,
          zoneId: t.zoneId,
          zoneName,
          status: t.status || 'AVAILABLE',
          effectiveStatus,
          chipTone,
        };
      });

      setTables(enriched);
      setCategories(menuRes.categories || []);
      setProducts(menuRes.products || []);
      if (settingsRes?.operatingMode) {
        setOperatingMode(settingsRes.operatingMode as 'hybrid' | 'waiter_only');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos de la terminal de meseros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Paso 1: Selección de Mesa y Apertura/Recuperación de Sesión Staff
  const handleSelectTable = async (table: EnrichedTable) => {
    if (table.effectiveStatus === 'DESHABILITADA') {
      setError(`La mesa ${table.label} se encuentra deshabilitada`);
      return;
    }

    setSelectingTableId(table.tableId);
    setError(null);
    try {
      const res = await staffOpenSession(table.tableId);
      const sessionObj = (res as any)?.session || res;
      const sessionId =
        sessionObj?.sessionId || (sessionObj as any)?.id || (res as any)?.sessionId || (res as any)?.id;

      if (!sessionId) {
        throw new Error('No se pudo obtener el identificador de sesión');
      }

      setSelectedTable(table);
      setActiveSessionId(sessionId);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err?.message || `Error al abrir sesión en la mesa ${table.label}`);
    } finally {
      setSelectingTableId(null);
    }
  };

  // Paso 2: Agregar producto a pedido temporal
  const handleAddProduct = (prod: WaiterProduct) => {
    if (prod.isAvailable === false) return;

    const note = (itemNotesInput[prod.id] || '').trim();

    setCart((prev) => {
      // Si ya existe exactamente con la misma nota, incrementamos cantidad
      const existingIndex = prev.findIndex(
        (i) => i.productId === prod.id && i.notes === note
      );
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + 1,
        };
        return copy;
      }

      return [
        ...prev,
        {
          tempId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          notes: note,
        },
      ];
    });

    // Limpiar input de nota del producto tras agregar
    setItemNotesInput((prev) => ({ ...prev, [prod.id]: '' }));
  };

  const handleUpdateItemQuantity = (tempId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.tempId === tempId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as WaiterCartItem[];
    });
  };

  const handleUpdateItemNotes = (tempId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, notes } : item))
    );
  };

  const handleRemoveItem = (tempId: string) => {
    setCart((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  // Totales
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Paso 3: Enviar a Cocina
  const handleConfirmOrder = async () => {
    if (!selectedTable || !activeSessionId) {
      setError('Debes seleccionar una mesa con sesión activa');
      return;
    }

    if (cart.length === 0) {
      setError('El pedido no contiene ningún producto');
      return;
    }

    if (generalNotes.length > 280) {
      setError('Las notas generales no pueden superar 280 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Agregar cada ítem del carrito temporal al carrito del backend con su x-session-id
      for (const item of cart) {
        await addWaiterCartItem(activeSessionId, {
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          productName: item.name,
          unitPrice: item.price,
        });
      }

      // 2. Confirmar orden con x-session-id y notas generales
      await confirmWaiterOrder(activeSessionId, {
        tableId: selectedTable.tableId,
        notes: generalNotes,
      });

      setSuccessMessage(
        `¡Pedido enviado a cocina para Mesa ${selectedTable.label}!`
      );
      setLastConfirmedTable(selectedTable.label);
    } catch (err: any) {
      setError(err?.message || 'Error al enviar pedido a cocina');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Volver a Paso 1 tras éxito o cancelación
  const handleResetToStep1 = () => {
    setSelectedTable(null);
    setActiveSessionId(null);
    setCart([]);
    setGeneralNotes('');
    setSuccessMessage(null);
    setError(null);
    setCurrentStep(1);
    loadInitialData();
  };

  // Filtrado de productos por categoría
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'ALL') return products;
    return products.filter((p) => p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div
      style={{
        padding: '1.5rem',
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Encabezado con información de modo y barra de pasos */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <PageHeader
          greeting="Terminal de Meseros"
          subtitle="Atención guiada en mesa: selección, comanda y despacho a cocina"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            data-testid="operating-mode-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.875rem',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor:
                operatingMode === 'waiter_only'
                  ? 'var(--bento-status-reserved-bg)'
                  : 'var(--bento-status-available-bg)',
              color:
                operatingMode === 'waiter_only'
                  ? 'var(--bento-status-reserved-text)'
                  : 'var(--bento-status-available-text)',
              border: '1px solid var(--bento-border)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  operatingMode === 'waiter_only'
                    ? 'var(--bento-status-reserved)'
                    : 'var(--bento-status-available)',
              }}
            />
            {operatingMode === 'waiter_only' ? 'Modo: Solo Meseros' : 'Modo: Híbrido'}
          </span>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(224, 166, 166, 0.25)',
            border: '1px solid var(--bento-status-occupied)',
            color: 'var(--bento-status-occupied-text)',
            padding: '0.875rem 1.25rem',
            borderRadius: 'var(--bento-inner-radius)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pantalla de Éxito / Feedback tras enviar comanda */}
      {successMessage && (
        <BentoCard
          data-testid="order-success-feedback"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--bento-status-available-bg)',
              color: 'var(--bento-status-available-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <Svg>
              <polyline points="20 6 9 17 4 12" />
            </Svg>
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--bento-text)',
              margin: '0 0 0.5rem 0',
            }}
          >
            {successMessage}
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--bento-text-muted)',
              marginBottom: '2rem',
            }}
          >
            La orden ha sido despachada y ya se encuentra visible en el Monitor de Cocina
            (KDS).
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={handleResetToStep1}
              style={{
                minHeight: '44px',
                padding: '0.75rem 1.75rem',
                borderRadius: 'var(--bento-inner-radius)',
                backgroundColor: 'var(--bento-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(92, 103, 132, 0.3)',
              }}
            >
              Atender otra mesa
            </button>
            <button
              type="button"
              onClick={() => router.push('/kds')}
              style={{
                minHeight: '44px',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--bento-inner-radius)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Ver en Cocina (KDS)
            </button>
          </div>
        </BentoCard>
      )}

      {!successMessage && (
        <>
          {/* Barra de progreso de los 3 Pasos */}
          <nav
            aria-label="Progreso del pedido de mesero"
            style={{
              display: 'flex',
              gap: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
              padding: '0.5rem',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                flex: 1,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--bento-inner-radius)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: currentStep === 1 ? 600 : 500,
                fontSize: '0.875rem',
                backgroundColor:
                  currentStep === 1 ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                color:
                  currentStep === 1 ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                boxShadow:
                  currentStep === 1 ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  backgroundColor:
                    currentStep === 1 ? 'var(--bento-primary)' : 'rgba(0, 0, 0, 0.1)',
                  color: currentStep === 1 ? '#fff' : 'inherit',
                }}
              >
                1
              </span>
              1. Seleccionar Mesa
              {selectedTable && (
                <span style={{ fontSize: '0.75rem', color: 'var(--bento-primary)' }}>
                  (M-{selectedTable.label})
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={!selectedTable}
              onClick={() => selectedTable && setCurrentStep(2)}
              style={{
                flex: 1,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--bento-inner-radius)',
                border: 'none',
                cursor: selectedTable ? 'pointer' : 'not-allowed',
                opacity: selectedTable ? 1 : 0.5,
                fontWeight: currentStep === 2 ? 600 : 500,
                fontSize: '0.875rem',
                backgroundColor:
                  currentStep === 2 ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                color:
                  currentStep === 2 ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                boxShadow:
                  currentStep === 2 ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  backgroundColor:
                    currentStep === 2 ? 'var(--bento-primary)' : 'rgba(0, 0, 0, 0.1)',
                  color: currentStep === 2 ? '#fff' : 'inherit',
                }}
              >
                2
              </span>
              2. Agregar Productos
              {cartTotalItems > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--bento-primary)' }}>
                  ({cartTotalItems})
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={!selectedTable || cart.length === 0}
              onClick={() => selectedTable && cart.length > 0 && setCurrentStep(3)}
              style={{
                flex: 1,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--bento-inner-radius)',
                border: 'none',
                cursor: selectedTable && cart.length > 0 ? 'pointer' : 'not-allowed',
                opacity: selectedTable && cart.length > 0 ? 1 : 0.5,
                fontWeight: currentStep === 3 ? 600 : 500,
                fontSize: '0.875rem',
                backgroundColor:
                  currentStep === 3 ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                color:
                  currentStep === 3 ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                boxShadow:
                  currentStep === 3 ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  backgroundColor:
                    currentStep === 3 ? 'var(--bento-primary)' : 'rgba(0, 0, 0, 0.1)',
                  color: currentStep === 3 ? '#fff' : 'inherit',
                }}
              >
                3
              </span>
              3. Revisión y Envío
            </button>
          </nav>

          {/* ============================================================== */}
          {/* PASO 1: SELECCIONAR MESA (Grid con número, capacidad, zona, chips) */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div data-testid="step-1-tables" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: 'var(--bento-text)',
                      margin: 0,
                    }}
                  >
                    1. Seleccionar Mesa
                  </h2>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--bento-text-muted)',
                      margin: '4px 0 0 0',
                    }}
                  >
                    Toca la mesa para abrir o recuperar su sesión activa
                  </p>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--bento-text-muted)' }}>
                  Cargando mesas configuradas...
                </div>
              ) : tables.length === 0 ? (
                <BentoCard style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ margin: 0, color: 'var(--bento-text-muted)' }}>
                    No hay mesas configuradas en el restaurante.
                  </p>
                </BentoCard>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {tables.map((t) => {
                    const isSelected = selectedTable?.tableId === t.tableId;
                    const isOpening = selectingTableId === t.tableId;

                    return (
                      <button
                        key={t.tableId}
                        type="button"
                        data-testid={`table-card-${t.tableId}`}
                        onClick={() => handleSelectTable(t)}
                        disabled={t.effectiveStatus === 'DESHABILITADA' || isOpening}
                        style={{
                          minHeight: '110px',
                          padding: '1.25rem',
                          borderRadius: 'var(--bento-inner-radius)',
                          backgroundColor: isSelected
                            ? 'rgba(255, 255, 255, 0.95)'
                            : 'rgba(255, 255, 255, 0.6)',
                          border: isSelected
                            ? '2px solid var(--bento-primary)'
                            : '1px solid var(--bento-border)',
                          boxShadow: isSelected
                            ? '0 4px 16px rgba(92, 103, 132, 0.2)'
                            : 'var(--bento-card-shadow)',
                          textAlign: 'left',
                          cursor:
                            t.effectiveStatus === 'DESHABILITADA'
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: t.effectiveStatus === 'DESHABILITADA' ? 0.4 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color: 'var(--bento-text)',
                              }}
                            >
                              Mesa {t.label}
                            </span>
                            <p
                              style={{
                                margin: '2px 0 0 0',
                                fontSize: '0.75rem',
                                color: 'var(--bento-text-muted)',
                              }}
                            >
                              {t.capacity} puestos • {t.zoneName}
                            </p>
                          </div>

                          <StatusChip
                            label={
                              t.effectiveStatus === 'LIBRE'
                                ? 'Libre'
                                : t.effectiveStatus === 'OCUPADA'
                                ? 'Ocupada'
                                : t.effectiveStatus === 'RESERVADA'
                                ? 'Reservada'
                                : 'Deshabilitada'
                            }
                            tone={t.chipTone}
                          />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '0.75rem',
                            paddingTop: '0.5rem',
                            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--bento-primary)',
                            }}
                          >
                            {isOpening ? 'Abriendo sesión...' : 'Seleccionar Mesa →'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 2: AGREGAR PRODUCTOS DISPONIBLES (Agotados deshabilitados) */}
          {/* ============================================================== */}
          {currentStep === 2 && selectedTable && (
            <div data-testid="step-2-menu" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Barra superior de mesa activa */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--bento-inner-radius)',
                  border: '1px solid var(--bento-border)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--bento-primary)',
                    }}
                  >
                    Mesa en atención
                  </span>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--bento-text)',
                      margin: '2px 0 0 0',
                    }}
                  >
                    Mesa {selectedTable.label} ({selectedTable.zoneName} • {selectedTable.capacity} puestos)
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--bento-inner-radius)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--bento-border)',
                      color: 'var(--bento-text-muted)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cambiar Mesa
                  </button>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => setCurrentStep(3)}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1.25rem',
                      borderRadius: 'var(--bento-inner-radius)',
                      backgroundColor:
                        cart.length > 0 ? 'var(--bento-primary)' : 'rgba(0,0,0,0.1)',
                      color: cart.length > 0 ? '#fff' : 'var(--bento-text-muted)',
                      border: 'none',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                      boxShadow:
                        cart.length > 0 ? '0 2px 8px rgba(92, 103, 132, 0.3)' : 'none',
                    }}
                  >
                    Revisar Pedido ({cartTotalItems} ítems) • {formatCOP(cartTotal)} →
                  </button>
                </div>
              </div>

              {/* Selector de Categorías */}
              {categories.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    paddingBottom: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1.125rem',
                      borderRadius: 'var(--bento-pill-radius)',
                      border: '1px solid var(--bento-border)',
                      backgroundColor:
                        selectedCategory === 'ALL'
                          ? 'var(--bento-primary)'
                          : 'rgba(255, 255, 255, 0.6)',
                      color: selectedCategory === 'ALL' ? '#ffffff' : 'var(--bento-text)',
                      fontWeight: selectedCategory === 'ALL' ? 600 : 500,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Todas ({products.length})
                  </button>
                  {categories.map((c) => {
                    const count = products.filter((p) => p.categoryId === c.id).length;
                    const isActive = selectedCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategory(c.id)}
                        style={{
                          minHeight: '44px',
                          padding: '0.5rem 1.125rem',
                          borderRadius: 'var(--bento-pill-radius)',
                          border: '1px solid var(--bento-border)',
                          backgroundColor: isActive
                            ? 'var(--bento-primary)'
                            : 'rgba(255, 255, 255, 0.6)',
                          color: isActive ? '#ffffff' : 'var(--bento-text)',
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Lista/Grid de Productos */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1rem',
                }}
              >
                {filteredProducts.map((prod) => {
                  const isAvailable = prod.isAvailable !== false;
                  const itemNote = itemNotesInput[prod.id] || '';

                  return (
                    <div
                      key={prod.id}
                      data-testid={`product-card-${prod.id}`}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.65)',
                        border: '1px solid var(--bento-border)',
                        borderRadius: 'var(--bento-inner-radius)',
                        padding: '1.25rem',
                        boxShadow: 'var(--bento-card-shadow)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        opacity: isAvailable ? 1 : 0.5,
                        filter: isAvailable ? 'none' : 'grayscale(0.6)',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1rem',
                              fontWeight: 600,
                              color: 'var(--bento-text)',
                            }}
                          >
                            {prod.name}
                          </h3>
                          {!isAvailable && (
                            <span
                              data-testid={`badge-agotado-${prod.id}`}
                              style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: 'var(--bento-pill-radius)',
                                backgroundColor: 'rgba(224, 166, 166, 0.25)',
                                color: 'var(--bento-status-occupied-text)',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                border: '1px solid var(--bento-status-occupied)',
                              }}
                            >
                              Agotado
                            </span>
                          )}
                        </div>

                        {prod.description && (
                          <p
                            style={{
                              margin: '0 0 0.5rem 0',
                              fontSize: '0.8125rem',
                              color: 'var(--bento-text-muted)',
                              lineHeight: 1.4,
                            }}
                          >
                            {prod.description}
                          </p>
                        )}

                        <p
                          style={{
                            margin: 0,
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            color: 'var(--bento-text)',
                          }}
                        >
                          {formatCOP(prod.price)}
                        </p>
                      </div>

                      {/* Campo para nota de preparación individual del ítem */}
                      {isAvailable && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          <label
                            htmlFor={`note-${prod.id}`}
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--bento-text-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Instrucciones de preparación (opcional) para {prod.name}
                          </label>
                          <input
                            id={`note-${prod.id}`}
                            data-testid={`item-note-input-${prod.id}`}
                            type="text"
                            placeholder="Ej: Término medio, sin cebolla..."
                            value={itemNote}
                            onChange={(e) =>
                              setItemNotesInput((prev) => ({
                                ...prev,
                                [prod.id]: e.target.value,
                              }))
                            }
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--bento-inner-radius)',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              fontSize: '0.8125rem',
                              backgroundColor: '#ffffff',
                              color: 'var(--bento-text)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}

                      {/* Botón de acción Agregar / Agotado */}
                      <button
                        type="button"
                        data-testid={`btn-add-product-${prod.id}`}
                        disabled={!isAvailable}
                        aria-disabled={!isAvailable}
                        onClick={() => handleAddProduct(prod)}
                        style={{
                          minHeight: '44px',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          borderRadius: 'var(--bento-inner-radius)',
                          backgroundColor: isAvailable
                            ? 'var(--bento-primary)'
                            : 'rgba(0, 0, 0, 0.08)',
                          color: isAvailable ? '#ffffff' : 'var(--bento-text-muted)',
                          border: 'none',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          boxShadow: isAvailable
                            ? '0 2px 6px rgba(92, 103, 132, 0.25)'
                            : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isAvailable ? (
                          <>
                            <Svg>
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </Svg>
                            Agregar al pedido
                          </>
                        ) : (
                          'Producto Agotado'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 3: REVISIÓN Y ENVÍO A COCINA (Notas por ítem + Generales)  */}
          {/* ============================================================== */}
          {currentStep === 3 && selectedTable && (
            <div data-testid="step-3-review" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <BentoCard style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)', padding: '2rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--bento-primary)',
                      }}
                    >
                      Paso 3 • Confirmación
                    </span>
                    <h2
                      style={{
                        fontSize: '1.375rem',
                        fontWeight: 700,
                        color: 'var(--bento-text)',
                        margin: '2px 0 0 0',
                      }}
                    >
                      Pedido para Mesa {selectedTable.label}
                    </h2>
                    <p
                      style={{
                        margin: '2px 0 0 0',
                        fontSize: '0.8125rem',
                        color: 'var(--bento-text-muted)',
                      }}
                    >
                      Zona: {selectedTable.zoneName} • {selectedTable.capacity} puestos
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    style={{
                      minHeight: '44px',
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--bento-inner-radius)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--bento-border)',
                      color: 'var(--bento-text)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    ← Agregar más productos
                  </button>
                </div>

                {/* Lista de Ítems */}
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--bento-text-muted)' }}>
                    No hay productos en el pedido actual.{' '}
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--bento-primary)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Ir a la carta
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {cart.map((item) => (
                      <div
                        key={item.tempId}
                        data-testid={`cart-item-${item.tempId}`}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.7)',
                          border: '1px solid var(--bento-border)',
                          borderRadius: 'var(--bento-inner-radius)',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: 'var(--bento-text)',
                              }}
                            >
                              {item.name}
                            </span>
                            <span
                              style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.8125rem',
                                color: 'var(--bento-text-muted)',
                              }}
                            >
                              ({formatCOP(item.price)} c/u)
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span
                              style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: 'var(--bento-text)',
                              }}
                            >
                              {formatCOP(item.price * item.quantity)}
                            </span>

                            {/* Controles de cantidad */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                borderRadius: 'var(--bento-pill-radius)',
                                padding: '2px',
                              }}
                            >
                              <button
                                type="button"
                                aria-label="Disminuir cantidad"
                                onClick={() => handleUpdateItemQuantity(item.tempId, -1)}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  backgroundColor: '#ffffff',
                                  color: 'var(--bento-text)',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  padding: '0 0.5rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  color: 'var(--bento-text)',
                                }}
                              >
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label="Aumentar cantidad"
                                onClick={() => handleUpdateItemQuantity(item.tempId, 1)}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  backgroundColor: '#ffffff',
                                  color: 'var(--bento-text)',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              aria-label={`Eliminar ${item.name}`}
                              onClick={() => handleRemoveItem(item.tempId)}
                              style={{
                                minHeight: '36px',
                                minWidth: '36px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--bento-status-occupied-text)',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Svg>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </Svg>
                            </button>
                          </div>
                        </div>

                        {/* Input de Nota por Ítem */}
                        <div>
                          <input
                            type="text"
                            aria-label={`Nota de preparación para ${item.name}`}
                            data-testid={`item-note-${item.tempId}`}
                            placeholder="Nota de preparación (ej: sin cebolla, término medio)..."
                            value={item.notes}
                            onChange={(e) => handleUpdateItemNotes(item.tempId, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--bento-inner-radius)',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              fontSize: '0.8125rem',
                              backgroundColor: '#ffffff',
                              color: 'var(--bento-text)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sección de Otras Solicitudes Generales de la Comanda (<= 280 caracteres) */}
                <div style={{ marginTop: '1.75rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.375rem',
                    }}
                  >
                    <label
                      htmlFor="general-notes"
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--bento-text)',
                      }}
                    >
                      Otras solicitudes generales de la comanda
                    </label>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color:
                          generalNotes.length > 280
                            ? 'var(--bento-status-occupied-text)'
                            : 'var(--bento-text-muted)',
                        fontWeight: generalNotes.length > 250 ? 600 : 400,
                      }}
                    >
                      {generalNotes.length} / 280
                    </span>
                  </div>
                  <textarea
                    id="general-notes"
                    data-testid="general-notes-textarea"
                    rows={3}
                    maxLength={280}
                    placeholder="Otras solicitudes para cocina o servicio (ej: traer platos hondos, servir entradas primero)..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--bento-inner-radius)',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'none',
                      backgroundColor: '#ffffff',
                      color: 'var(--bento-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Total y Botón de Envío a Cocina */}
                <div
                  style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--bento-text-muted)',
                      }}
                    >
                      Total comanda ({cartTotalItems} productos):
                    </span>
                    <span
                      data-testid="order-total-cop"
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: 'var(--bento-text)',
                      }}
                    >
                      {formatCOP(cartTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="btn-send-to-kitchen"
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleConfirmOrder}
                    style={{
                      minHeight: '52px',
                      width: '100%',
                      borderRadius: 'var(--bento-inner-radius)',
                      backgroundColor:
                        cart.length > 0 && !isSubmitting
                          ? 'var(--bento-primary)'
                          : 'rgba(0, 0, 0, 0.15)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor:
                        cart.length > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                      boxShadow:
                        cart.length > 0 && !isSubmitting
                          ? '0 4px 14px rgba(92, 103, 132, 0.35)'
                          : 'none',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {isSubmitting ? (
                      'Enviando a Cocina...'
                    ) : (
                      <>
                        <Svg>
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </Svg>
                        Enviar a Cocina • {formatCOP(cartTotal)}
                      </>
                    )}
                  </button>
                </div>
              </BentoCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
