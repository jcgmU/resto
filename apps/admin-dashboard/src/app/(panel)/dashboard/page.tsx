"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  KpiDelta,
  FeatureGuard,
  Proximamente,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';
import { DASHBOARD_CSS } from '../../../components/dashboard/dashboardStyles';

interface SessionItem {
  id: string;
  sessionId?: string;
  tableId: string;
  status: string;
}

interface TableItem {
  tableId: string;
  label?: string;
  status: string;
}

interface OrderItem {
  id: string;
  status: string;
  total?: number;
  tableId?: string;
  createdAt?: string;
}

interface ServiceCallItem {
  id: string;
  tableId: string;
  note?: string;
  status: string;
  createdAt?: string;
}

type TableState = 'libre' | 'ocupada' | 'cuenta' | 'mesero';

const TABLE_STATE_LABEL: Record<TableState, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta: 'Pidió la cuenta',
  mesero: 'Llamó al mesero',
};

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// Datos de ejemplo: todavía no existe un servicio de ingresos que los alimente.
const SAMPLE_WEEK: ReadonlyArray<{ day: string; total: number }> = [
  { day: 'Lun', total: 1920000 },
  { day: 'Mar', total: 2140000 },
  { day: 'Mié', total: 1780000 },
  { day: 'Jue', total: 2410000 },
  { day: 'Vie', total: 3350000 },
  { day: 'Sáb', total: 4180000 },
  { day: 'Dom', total: 2847500 },
];

function RevenueChart() {
  const w = 360;
  const h = 150;
  const top = 8;
  const base = h - 22;
  const max = 4500000;
  const slot = w / SAMPLE_WEEK.length;
  const barW = Math.min(30, slot - 12);
  const ticks = [0, 2000000, 4000000];
  const y = (v: number) => base - (v / max) * (base - top);
  return (
    <svg
      className="rev-chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Ingresos de los últimos 7 días en pesos colombianos. Ejemplo: el domingo suma 2.847.500 pesos."
    >
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={0} x2={w} y1={y(t)} y2={y(t)} />
          <text x={0} y={y(t) - 4}>{t === 0 ? '0' : `${t / 1000000} M`}</text>
        </g>
      ))}
      {SAMPLE_WEEK.map((d, i) => {
        const x = i * slot + (slot - barW) / 2;
        const isToday = i === SAMPLE_WEEK.length - 1;
        return (
          <g key={d.day}>
            <rect
              className={isToday ? 'bar today' : 'bar'}
              x={x}
              y={y(d.total)}
              width={barW}
              height={base - y(d.total)}
              rx={8}
            />
            <text x={x + barW / 2} y={h - 6} textAnchor="middle">{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSessions, setActiveSessions] = useState<SessionItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCallItem[]>([]);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [sessionsRes, tablesRes, ordersRes, callsRes] = await Promise.all([
        ApiClient.request('/v1/sessions?status=active'),
        ApiClient.request('/v1/tables'),
        ApiClient.request('/v1/orders'),
        ApiClient.request('/v1/service-calls?status=pending'),
      ]);

      const sessionsData = Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data || [];
      const tablesData = Array.isArray(tablesRes) ? tablesRes : tablesRes?.data || [];
      const ordersData = Array.isArray(ordersRes) ? ordersRes : ordersRes?.data || [];
      const callsData = Array.isArray(callsRes) ? callsRes : callsRes?.data || [];

      setActiveSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setServiceCalls(Array.isArray(callsData) ? callsData : []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los datos del dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Sondeo silencioso: las sesiones nuevas (QR escaneado) no llegan por socket.
    const timer = setInterval(() => fetchDashboardData(true), 5000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="dash">
        <style>{DASHBOARD_CSS}</style>
        <div className="dash-grid">
          <div className="glass span-2"><Skeleton height="120px" /></div>
          <div className="glass span-2 row-2"><Skeleton height="260px" /></div>
          <div className="glass"><Skeleton height="72px" /></div>
          <div className="glass"><Skeleton height="72px" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorState
          title="Error al cargar dashboard"
          message={error}
          onRetry={() => fetchDashboardData()}
          retryLabel="Reintentar"
        />
      </div>
    );
  }

  const activeTables = tables.filter((t) => t.status !== 'deleted');
  const distinctActiveTableIds = new Set(
    activeSessions.map((s: any) => s.tableId).filter(Boolean)
  );
  const activeTablesCount = distinctActiveTableIds.size;
  const totalTablesCount = activeTables.length;
  const activeOrdersCount = orders.filter((o) =>
    ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
  ).length;

  const callByTable = new Map<string, ServiceCallItem>();
  serviceCalls.forEach((c) => {
    if (!callByTable.has(c.tableId)) callByTable.set(c.tableId, c);
  });

  const stateOf = (tableId: string): TableState => {
    const call = callByTable.get(tableId);
    if (call) return /cuenta/i.test(call.note || '') ? 'cuenta' : 'mesero';
    return distinctActiveTableIds.has(tableId) ? 'ocupada' : 'libre';
  };

  const labelOf = (tableId: string) => {
    const match = tables.find((t) => (t.tableId || (t as any).id) === tableId);
    return match?.label || `Mesa ${tableId}`;
  };

  return (
    <div className="dash">
      <style>{DASHBOARD_CSS}</style>
      <div className="dash-grid">
        <section className="glass span-2" aria-label="Ingresos">
          <FeatureGuard flag="analytics" fallback={<Proximamente featureName="Ingresos del día" />}>
            <div className="glass-head">
              <h2>Ingresos de hoy</h2>
              <span className="tag">Datos de ejemplo</span>
            </div>
            <div className="rev-figure">{cop.format(2847500)}</div>
            <p className="rev-meta">+8,4 % frente al domingo pasado · ticket promedio {cop.format(48300)}</p>
            <RevenueChart />
          </FeatureGuard>
        </section>

        <section className="glass span-2 row-2" aria-label="Mapa de mesas">
          <div className="glass-head">
            <h2>Mapa de mesas</h2>
            <span className="tag">{activeTablesCount} de {totalTablesCount} ocupadas</span>
          </div>
          <ul className="legend" aria-label="Leyenda de estados">
            <li><i className="swatch" />Libre</li>
            <li><i className="swatch ocupada" />Ocupada</li>
            <li><i className="swatch cuenta" />Pidió la cuenta</li>
            <li><i className="swatch mesero" />Llamó al mesero</li>
          </ul>
          {activeTables.length === 0 ? (
            <EmptyState
              title="Aún no hay mesas"
              description="Crea tus mesas en la sección Mesas para verlas aquí."
            />
          ) : (
            <div className="floor">
              {activeTables.map((t) => {
                const id = t.tableId || (t as any).id;
                const state = stateOf(id);
                return (
                  <div key={id} className={`tbl ${state}`} data-state={state}>
                    <b>{labelOf(id)}</b>
                    <small>{TABLE_STATE_LABEL[state]}</small>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass" aria-label="Mesas activas">
          <KpiDelta
            label="Mesas Activas"
            value={String(activeTablesCount)}
            delta={activeTablesCount > 0 ? `${activeTablesCount} en sala` : 'sin mesas'}
            trend={activeTablesCount > 0 ? 'up' : 'neutral'}
            context={`de ${totalTablesCount} mesas configuradas`}
          />
        </section>

        <section className="glass" aria-label="Pedidos activos">
          <KpiDelta
            label="Pedidos Activos"
            value={String(activeOrdersCount)}
            delta={activeOrdersCount > 0 ? `${activeOrdersCount} en curso` : 'al día'}
            trend={activeOrdersCount > 0 ? 'up' : 'neutral'}
            context="en preparación y sala"
          />
        </section>

        <section className="glass span-2" aria-label="Brief operativo y alertas">
          <div className="glass-head">
            <h2>Brief Operativo & Alertas</h2>
            {serviceCalls.length > 0 && (
              <span className="tag tag-warn">{serviceCalls.length} pendientes</span>
            )}
          </div>
          {serviceCalls.length === 0 ? (
            <EmptyState
              title="Sin alertas activas"
              description="Servicio al día. No hay llamadas de mesero ni solicitudes pendientes."
            />
          ) : (
            <ul className="calls">
              {serviceCalls.map((call) => (
                <li key={call.id}>
                  <div>
                    <b>{labelOf(call.tableId)}</b>
                    <span className="note">{call.note || 'Solicitud de asistencia'}</span>
                  </div>
                  <span className="tag tag-warn">Pendiente</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass span-2" aria-label="Accesos rápidos de inventario">
          <div className="glass-head">
            <h2>Inventario</h2>
          </div>
          <div className="quick">
            <a className="quick-item" href="/menu">
              <b>Disponibilidad de productos</b>
              <small>Activa o agota platos del menú</small>
            </a>
            {['Ver existencias', 'Registrar compra', 'Ajustar inventario'].map((name) => (
              <button
                key={name}
                type="button"
                className="quick-item"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
              >
                <b>{name}</b>
                <small>Pronto</small>
              </button>
            ))}
          </div>
          <p className="sample-note">
            El módulo de existencias aún no está conectado. Por ahora solo funciona la disponibilidad del menú.
          </p>
        </section>
      </div>
    </div>
  );
}
