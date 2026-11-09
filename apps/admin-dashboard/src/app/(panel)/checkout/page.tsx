"use client";
import React, { useState, useEffect, useRef } from 'react';
import { FeatureGuard, BentoCard } from '@packages/ui-components';
import { BillDTO, PaymentMethod, TableSessionDTO, TableDTO } from '@packages/shared-types';
import {
  ActiveTablesGrid,
  BillSummaryCard,
  PaymentMethodPicker,
  ConfirmPaymentButton,
  PaymentSuccessCard,
} from '../../../components/checkout';
import { ApiClient } from '../../../lib/api';

export default function CheckoutPage() {
  const [sessions, setSessions] = useState<TableSessionDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TableSessionDTO | null>(null);
  const [bill, setBill] = useState<BillDTO | null>(null);
  const [currentRequestGen, setCurrentRequestGen] = useState(0);
  const [loadedBillGen, setLoadedBillGen] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<{
    tableId: string;
    amount: number;
    method: PaymentMethod;
  } | null>(null);

  const isMountedRef = useRef(true);
  const latestRequestedSessionIdRef = useRef<string | null>(null);
  const billRequestGenRef = useRef(0);
  const isProcessingPaymentRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const paidSessionIdsRef = useRef<Set<string>>(new Set());

  const fetchTables = async () => {
    try {
      const res = await ApiClient.request('/v1/tables');
      if (!isMountedRef.current) return;
      if (Array.isArray(res)) {
        setTables(res.filter((t: TableDTO) => (t as any).status !== 'deleted'));
      } else if (res?.data && Array.isArray(res.data)) {
        setTables(res.data.filter((t: TableDTO) => (t as any).status !== 'deleted'));
      }
    } catch {
      // no bloqueante si falla la lista de mesas
    }
  };

  const fetchActiveSessions = async () => {
    if (!isMountedRef.current) return;
    setLoadingSessions(true);
    try {
      const res = await ApiClient.request('/v1/sessions?status=active');
      if (!isMountedRef.current) return;
      const filterPaid = (list: TableSessionDTO[]) =>
        list.filter((s) => !paidSessionIdsRef.current.has(s.sessionId));
      if (Array.isArray(res)) {
        setSessions(filterPaid(res));
      } else if (res?.data && Array.isArray(res.data)) {
        setSessions(filterPaid(res.data));
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err.code || err.message || 'Error al obtener sesiones activas');
    } finally {
      if (isMountedRef.current) {
        setLoadingSessions(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchActiveSessions();
    fetchTables();

    return () => {
      isMountedRef.current = false;
      latestRequestedSessionIdRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelectSession = async (session: TableSessionDTO) => {
    if (paidSessionIdsRef.current.has(session.sessionId)) {
      return;
    }
    // Abort previous in-flight bill request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const requestedSessionId = session.sessionId;
    const reqGen = ++billRequestGenRef.current;
    latestRequestedSessionIdRef.current = requestedSessionId;

    setSelectedSession(session);
    setCurrentRequestGen(reqGen);
    setLoadedBillGen(null);
    setLoadingBill(true);
    setError(undefined);
    setCompletedPayment(null);
    setBill(null);
    setMethod(null);

    try {
      const res = await ApiClient.request(`/v1/checkout/${requestedSessionId}`, {
        signal: abortController.signal,
      });

      // DISCARD if unmounted, already paid, or if another request generation / session was started in the meantime
      if (
        !isMountedRef.current ||
        paidSessionIdsRef.current.has(requestedSessionId) ||
        billRequestGenRef.current !== reqGen ||
        latestRequestedSessionIdRef.current !== requestedSessionId
      ) {
        return;
      }

      const billData = res?.data || res;
      // Safety check: bill must belong to the requested session and not already paid
      if (billData && billData.sessionId && billData.sessionId !== requestedSessionId) {
        return;
      }
      if (billData?.payment?.status === 'COMPLETED') {
        paidSessionIdsRef.current.add(requestedSessionId);
        latestRequestedSessionIdRef.current = null;
        setSessions((prev) => prev.filter((s) => s.sessionId !== requestedSessionId));
        setSelectedSession(null);
        setBill(null);
        setLoadedBillGen(null);
        setMethod(null);
        return;
      }

      setBill(billData);
      setLoadedBillGen(reqGen);
    } catch (err: any) {
      // DISCARD error if unmounted, already paid, or if user started a newer request generation or if aborted
      if (
        !isMountedRef.current ||
        paidSessionIdsRef.current.has(requestedSessionId) ||
        billRequestGenRef.current !== reqGen ||
        latestRequestedSessionIdRef.current !== requestedSessionId
      ) {
        return;
      }
      if (err.name === 'AbortError') return;

      setError(err.message || err.code || 'Error al obtener la cuenta de la mesa');
    } finally {
      if (
        isMountedRef.current &&
        billRequestGenRef.current === reqGen &&
        latestRequestedSessionIdRef.current === requestedSessionId
      ) {
        setLoadingBill(false);
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (isProcessingPaymentRef.current || isProcessingPayment) return;
    if (!selectedSession || !bill || !method) return;
    if (loadingBill) return;
    if (bill.sessionId !== selectedSession.sessionId) return;
    if (loadedBillGen === null || loadedBillGen !== currentRequestGen || billRequestGenRef.current !== currentRequestGen) {
      return;
    }

    // Snapshot immutable state at confirmation time
    const snapshotSessionId = selectedSession.sessionId;
    const snapshotTableId = selectedSession.tableId;
    const snapshotBillTotal = bill.total;
    const snapshotMethod = method;
    const snapshotRequestGen = billRequestGenRef.current;

    isProcessingPaymentRef.current = true;
    setIsProcessingPayment(true);
    setError(undefined);

    try {
      const res = await ApiClient.request('/v1/checkout/confirm', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: snapshotSessionId,
          tableId: snapshotTableId,
          method: snapshotMethod,
        }),
      });

      if (!isMountedRef.current) return;

      paidSessionIdsRef.current.add(snapshotSessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== snapshotSessionId));

      const paymentResult = res?.data || res;
      setCompletedPayment({
        tableId: snapshotTableId,
        amount: paymentResult?.amount || snapshotBillTotal,
        method: snapshotMethod,
      });

      // Invalidate & clear selection if the currently selected session is the one that was just paid,
      // even if request generation advanced due to an A -> B -> A selection switch while POST was in flight!
      if (latestRequestedSessionIdRef.current === snapshotSessionId) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const nextGen = ++billRequestGenRef.current;
        latestRequestedSessionIdRef.current = null;
        setCurrentRequestGen(nextGen);
        setSelectedSession(null);
        setBill(null);
        setLoadedBillGen(null);
        setLoadingBill(false);
        setMethod(null);
        setError(undefined);
      }

      await fetchActiveSessions();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (
        latestRequestedSessionIdRef.current === snapshotSessionId &&
        billRequestGenRef.current === snapshotRequestGen
      ) {
        setError(err.code || err.message || 'Error al procesar cobro');
      }
    } finally {
      isProcessingPaymentRef.current = false;
      if (isMountedRef.current) {
        setIsProcessingPayment(false);
      }
    }
  };

  const activeBill =
    bill &&
    selectedSession &&
    bill.sessionId === selectedSession.sessionId &&
    loadedBillGen !== null &&
    loadedBillGen === currentRequestGen
      ? bill
      : null;

  const handleRetry = async () => {
    if (selectedSession && !activeBill) {
      await handleSelectSession(selectedSession);
    } else if (!selectedSession) {
      await fetchActiveSessions();
    } else {
      await handleConfirmPayment();
    }
  };

  return (
    <FeatureGuard flag="payments">
      <div data-testid="checkout-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {completedPayment && (
          <div style={{ marginBottom: '16px' }}>
            <PaymentSuccessCard
              tableId={completedPayment.tableId}
              amount={completedPayment.amount}
              method={completedPayment.method}
              tables={tables}
            />
          </div>
        )}

        <BentoCard
          style={{
            backgroundColor: 'var(--bento-papel)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '1.1rem',
              marginTop: 0,
              marginBottom: '16px',
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
            }}
          >
            Mesas Activas
          </h2>
          <ActiveTablesGrid
            loading={loadingSessions}
            sessions={sessions}
            tables={tables}
            selectedSessionId={selectedSession?.sessionId}
            onSelectSession={handleSelectSession}
          />
        </BentoCard>

        {!activeBill && error && (
          <BentoCard
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              role="alert"
              tabIndex={-1}
              style={{
                padding: '12px',
                borderRadius: 'var(--bento-inner-radius)',
                background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
                color: 'var(--bento-destructive)',
                border: '1px solid var(--bento-destructive)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontFamily: 'var(--bento-font-body)' }}>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0 16px',
                  borderRadius: 'var(--bento-pill-radius)',
                  background: 'var(--bento-destructive)',
                  color: 'var(--bento-papel)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                }}
              >
                Reintentar
              </button>
            </div>
          </BentoCard>
        )}

        {activeBill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <BillSummaryCard bill={activeBill} tables={tables} error={error} onRetry={handleRetry} />
            <PaymentMethodPicker selectedMethod={method} onSelect={setMethod} />
            <ConfirmPaymentButton
              disabled={!method || loadingBill || isProcessingPayment}
              loading={isProcessingPayment}
              sessionId={selectedSession?.sessionId}
              total={activeBill.total}
              method={method}
              onConfirm={handleConfirmPayment}
            />
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
