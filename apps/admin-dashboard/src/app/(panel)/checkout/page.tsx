"use client";
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { FeatureGuard, BentoCard, Skeleton, getTableDisplayName } from '@packages/ui-components';
import { BillDTO, PaymentMethod, TableSessionDTO, TableDTO } from '@packages/shared-types';
import {
  ActiveTablesGrid,
  BillSummaryCard,
  PaymentMethodPicker,
  ConfirmPaymentButton,
  PaymentSuccessCard,
  ReleaseTableModal,
} from '../../../components/checkout';
import {
  fetchActiveSessions as apiFetchActiveSessions,
  fetchTables as apiFetchTables,
  fetchSessionBill,
  confirmCheckout,
  closeSession,
  retryInvoice,
  parseCheckoutError,
  FormattedCheckoutError,
} from '../../../lib/api/checkout';
import { ApiClient } from '../../../lib/api';
import * as realtime from '../../../lib/realtime';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const tableIdParam = searchParams.get('tableId');
  const autoSelectedRef = useRef(false);
  const [sessions, setSessions] = useState<TableSessionDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<FormattedCheckoutError | null>(null);

  const [selectedSession, setSelectedSession] = useState<TableSessionDTO | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [bill, setBill] = useState<BillDTO | null>(null);
  const [billError, setBillError] = useState<FormattedCheckoutError | null>(null);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paymentError, setPaymentError] = useState<string | undefined>(undefined);
  const [completedPayment, setCompletedPayment] = useState<{
    tableId: string;
    amount: number;
    method: PaymentMethod;
    sessionId?: string;
    invoiceStatus?: 'none' | 'pending' | 'issued' | 'error';
    invoiceRef?: string;
    invoiceError?: string;
  } | null>(null);

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState<{
    tableId: string;
    displayName: string;
  } | null>(null);

  const fetchTables = async () => {
    try {
      const data = await apiFetchTables();
      setTables(data);
    } catch {
      // no bloqueante si falla la lista de mesas
    }
  };

  const fetchActiveSessions = async () => {
    setLoadingSessions(true);
    setSessionError(null);
    try {
      const data = await apiFetchActiveSessions();
      setSessions(data);
    } catch (err: any) {
      setSessionError(parseCheckoutError(err));
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    fetchTables();

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchActiveSessions();
        fetchTables();
      }
    };
    const handleFocus = () => {
      fetchActiveSessions();
      fetchTables();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    let socket: any = null;
    const token = ApiClient.token;
    if (token) {
      try {
        socket = realtime.connectOrdersSocket(token);
        socket.on('table:status-changed', () => {
          fetchActiveSessions();
          fetchTables();
        });
        socket.on('session:checkout-completed', () => {
          fetchActiveSessions();
          fetchTables();
        });
      } catch {
        // Fallback gracefully
      }
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
      if (socket) {
        try {
          socket.disconnect();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!tableIdParam || autoSelectedRef.current || sessions.length === 0) return;
    const match = sessions.find((s) => s.tableId === tableIdParam && s.status !== 'closed');
    if (match) {
      autoSelectedRef.current = true;
      handleSelectSession(match);
    }
  }, [tableIdParam, sessions]);

  const handleSelectSession = async (session: TableSessionDTO) => {
    setSelectedSession(session);
    setLoadingBill(true);
    setBill(null);
    setBillError(null);
    setPaymentError(undefined);
    setReleaseError(null);
    setCompletedPayment(null);
    setReleaseSuccess(null);
    setMethod(null);

    try {
      const billData = await fetchSessionBill(session.sessionId);
      setBill(billData);
    } catch (err: any) {
      setBillError(parseCheckoutError(err));
    } finally {
      setLoadingBill(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedSession || !bill || !method) return;
    setPaymentError(undefined);

    try {
      const result = await confirmCheckout({
        sessionId: selectedSession.sessionId,
        tableId: selectedSession.tableId,
        method,
        amount: bill.total,
      });

      const paymentData = result.payment;
      setCompletedPayment({
        tableId: selectedSession.tableId,
        amount: result.amount || bill.total,
        method,
        sessionId: selectedSession.sessionId,
        invoiceStatus: paymentData?.invoiceStatus,
        invoiceRef: paymentData?.invoiceRef,
        invoiceError: paymentData?.invoiceError,
      });

      setSelectedSession(null);
      setBill(null);
      setMethod(null);
      await fetchActiveSessions();
    } catch (err: any) {
      setPaymentError(err.code || err.message || 'Error al procesar cobro');
    }
  };

  const handleReleaseTable = async () => {
    if (!selectedSession) return;
    setIsReleasing(true);
    setReleaseError(null);

    try {
      await closeSession(selectedSession.sessionId);
      setIsReleaseModalOpen(false);
      setReleaseSuccess({
        tableId: selectedSession.tableId,
        displayName: getTableDisplayName(selectedSession.tableId, tables),
      });

      setSelectedSession(null);
      setBill(null);
      setMethod(null);
      await fetchActiveSessions();
    } catch (err: any) {
      const parsed = parseCheckoutError(err);
      setReleaseError(parsed.code || parsed.message);
    } finally {
      setIsReleasing(false);
    }
  };

  const handleRetry = async () => {
    if (sessionError) {
      await fetchActiveSessions();
      return;
    }
    if (selectedSession && !bill) {
      await handleSelectSession(selectedSession);
      return;
    }
    if (paymentError) {
      await handleConfirmPayment();
      return;
    }
    if (releaseError) {
      await handleReleaseTable();
      return;
    }
  };

  const tableDisplayName = selectedSession
    ? getTableDisplayName(selectedSession.tableId, tables)
    : '';

  const pendingAmount =
    bill && !bill.payment && bill.total > 0 ? bill.total : 0;

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
              sessionId={completedPayment.sessionId}
              invoiceStatus={completedPayment.invoiceStatus}
              invoiceRef={completedPayment.invoiceRef}
              invoiceError={completedPayment.invoiceError}
              onRetryInvoice={async () => {
                if (!completedPayment?.sessionId) return;
                try {
                  const retryRes = await retryInvoice(completedPayment.sessionId);
                  const pay = retryRes?.payment || retryRes;
                  if (pay) {
                    setCompletedPayment((prev) => prev ? {
                      ...prev,
                      invoiceStatus: pay.invoiceStatus,
                      invoiceRef: pay.invoiceRef,
                      invoiceError: pay.invoiceError,
                    } : null);
                  }
                } catch {}
              }}
            />
          </div>
        )}

        {releaseSuccess && (
          <div style={{ marginBottom: '16px' }}>
            <BentoCard
              data-testid="release-success-card"
              style={{
                padding: '20px',
                border: '1px solid var(--bento-success)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--bento-success)' }}>
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: '1.2rem', fontFamily: 'var(--bento-font-heading)' }}>
                  Mesa liberada exitosamente.
                </span>
              </div>
              <div style={{ color: 'var(--bento-text-muted)', fontFamily: 'var(--bento-font-body)' }}>
                {releaseSuccess.displayName} • Sesión cerrada
              </div>
            </BentoCard>
          </div>
        )}

        <BentoCard
          style={{
            backgroundColor: 'var(--bento-card-bg-solid)',
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

          {sessionError && (
            <div
              role="alert"
              data-testid="sessions-error-banner"
              tabIndex={-1}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--bento-inner-radius)',
                background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
                color: 'var(--bento-destructive)',
                border: '1px solid var(--bento-destructive)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
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
                <div>
                  <span style={{ fontWeight: 700, marginRight: '6px' }}>{sessionError.code}:</span>
                  <span style={{ fontFamily: 'var(--bento-font-body)' }}>{sessionError.userMessage}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchActiveSessions}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0 16px',
                  borderRadius: 'var(--bento-pill-radius)',
                  background: 'var(--bento-destructive)',
                  color: 'var(--bento-card-bg-solid)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                }}
              >
                Reintentar
              </button>
            </div>
          )}

          <ActiveTablesGrid
            loading={loadingSessions}
            sessions={sessions}
            tables={tables}
            selectedSessionId={selectedSession?.sessionId}
            onSelectSession={handleSelectSession}
          />
        </BentoCard>

        {loadingBill && (
          <BentoCard data-testid="bill-skeleton" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton width="40%" height="28px" />
            <Skeleton width="100%" height="60px" />
          </BentoCard>
        )}

        {billError && !bill && (
          billError.code === 'BILL_NOT_FOUND' ? (
            <BentoCard
              data-testid="bill-empty-state"
              style={{
                padding: '24px',
                borderRadius: 'var(--bento-card-radius)',
                backgroundColor: 'var(--bento-card-bg-solid)',
                border: '1px solid var(--bento-border)',
                boxShadow: 'var(--bento-card-shadow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--bento-inner-radius)',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--bento-text-muted)',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      fontFamily: 'var(--bento-font-heading)',
                      color: 'var(--bento-text)',
                    }}
                  >
                    Mesa sin consumo
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: 'var(--bento-text-muted)',
                      fontFamily: 'var(--bento-font-body)',
                    }}
                  >
                    Esta sesión no tiene pedidos registrados para cobrar.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedSession && (
                  <button
                    type="button"
                    onClick={() => setIsReleaseModalOpen(true)}
                    style={{
                      minHeight: '44px',
                      padding: '0 20px',
                      borderRadius: 'var(--bento-pill-radius)',
                      background: 'var(--bento-primary)',
                      color: 'var(--bento-card-bg-solid)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--bento-font-body)',
                      fontWeight: 600,
                      boxShadow: 'var(--bento-card-shadow)',
                    }}
                  >
                    Liberar mesa
                  </button>
                )}
              </div>
            </BentoCard>
          ) : (
            <div
              role="alert"
              data-testid="bill-error-banner"
              tabIndex={-1}
              style={{
                padding: '16px',
                borderRadius: 'var(--bento-inner-radius)',
                background: 'color-mix(in srgb, var(--bento-destructive) 10%, transparent)',
                color: 'var(--bento-destructive)',
                border: '1px solid var(--bento-destructive)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <span style={{ fontWeight: 700, marginRight: '6px' }}>{billError.code}:</span>
                  <span style={{ fontFamily: 'var(--bento-font-body)' }}>{billError.userMessage}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 16px',
                    borderRadius: 'var(--bento-pill-radius)',
                    background: 'var(--bento-destructive)',
                    color: 'var(--bento-card-bg-solid)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--bento-font-body)',
                    fontWeight: 600,
                  }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          )
        )}

        {bill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <BillSummaryCard
              bill={bill}
              tables={tables}
              error={paymentError}
              onRetry={handleRetry}
            />
            <PaymentMethodPicker selectedMethod={method} onSelect={setMethod} />
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <ConfirmPaymentButton
                disabled={!method}
                total={bill.total}
                method={method}
                onConfirm={handleConfirmPayment}
              />
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(true)}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: 'var(--bento-pill-radius)',
                  background: 'transparent',
                  color: 'var(--bento-text)',
                  border: '1px solid var(--bento-border)',
                  fontFamily: 'var(--bento-font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Liberar mesa
              </button>
            </div>
          </div>
        )}

        {selectedSession && (
          <ReleaseTableModal
            open={isReleaseModalOpen}
            tableName={tableDisplayName}
            pendingAmount={pendingAmount}
            loading={isReleasing}
            error={releaseError}
            onConfirm={handleReleaseTable}
            onClose={() => setIsReleaseModalOpen(false)}
            onRetry={handleReleaseTable}
          />
        )}
      </div>
    </FeatureGuard>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  );
}
