'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Skeleton, StatusCard } from '@packages/ui-components';
import { ApiClient } from '../lib/api';
import { getUserRole } from '../lib/auth';
import { useMoney } from '../lib/money';

interface SalesReport {
  total: string;
  tickets: number;
  averageTicket: string;
}

function canViewSales(): boolean {
  const tokenRole = getUserRole(ApiClient.token);
  if (tokenRole) return tokenRole === 'ADMIN' || tokenRole === 'MANAGER';
  try {
    const user = JSON.parse(localStorage.getItem('resto_user') || '{}');
    return user.role === 'ADMIN' || user.role === 'MANAGER';
  } catch {
    return false;
  }
}

export function SalesSummary() {
  const { format: formatMoney } = useMoney();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response = await ApiClient.request(`/v1/reports/sales/today?tz=${encodeURIComponent(timezone)}`);
      if (current === requestId.current) setReport(response?.data ?? response);
    } catch {
      if (current === requestId.current) setError(true);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewSales()) return undefined;
    setAllowed(true);
    void load();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      ++requestId.current;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [load]);

  if (!allowed) return null;
  if (loading) return <div role="status" aria-label="Cargando ventas"><Skeleton /></div>;
  if (error || !report) return <div role="alert">No se pudieron cargar las ventas. <Button variant="secondary" onClick={() => void load()}>Reintentar</Button></div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginTop: '24px' }}>
      <StatusCard status="neutral" style={{ padding: '24px' }}>
        <h3>Ventas del Día</h3>
        <p>{formatMoney(report.total)}</p>
        {report.tickets === 0 && <p>Sin ventas hoy</p>}
      </StatusCard>
      <StatusCard status="neutral" style={{ padding: '24px' }}>
        <h3>Ticket Promedio</h3>
        <p>{formatMoney(report.averageTicket)}</p>
      </StatusCard>
    </div>
  );
}
