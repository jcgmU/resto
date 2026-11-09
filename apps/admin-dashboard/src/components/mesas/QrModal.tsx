import React, { useEffect, useRef } from 'react';
import { FOCUSABLE_SELECTOR, TableItem, TableQrData } from './types';

export interface QrModalProps {
  activeTableQr: TableItem | null;
  qrData: TableQrData | null;
  qrLoading: boolean;
  qrError: string | null;
  onRotateQr: (table: TableItem) => void;
  onClose: () => void;
  canMutate?: boolean;
}

export function QrModal({
  activeTableQr,
  qrData,
  qrLoading,
  qrError,
  onRotateQr,
  onClose,
  canMutate = true,
}: QrModalProps) {
  const qrModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTableQr) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    qrModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!qrModalRef.current) return;
        const nodes = Array.from(
          qrModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === qrModalRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [activeTableQr, onClose]);

  if (!activeTableQr) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      ref={qrModalRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (!qrModalRef.current) return;
          const nodes = Array.from(
            qrModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
          );
          if (nodes.length === 0) {
            e.preventDefault();
            return;
          }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === qrModalRef.current)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'color-mix(in srgb, var(--bento-tinta) 45%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bento-papel)',
          color: 'var(--bento-text)',
          padding: '24px',
          borderRadius: 'var(--bento-card-radius)',
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--bento-card-shadow)',
          border: '1px solid var(--bento-border)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2
            id="qr-modal-title"
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
            }}
          >
            Código QR — {activeTableQr.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--bento-text-muted)',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {qrError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bento-papel)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-inner-radius)',
              marginBottom: '16px',
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            {qrError}
          </div>
        )}

        {qrLoading && !qrData ? (
          <div style={{ padding: '40px', color: 'var(--bento-text-muted)' }}>
            Cargando código QR...
          </div>
        ) : qrData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--bento-papel)',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-border)',
                marginBottom: '16px',
                display: 'inline-block',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrData.pngDataUrl}
                alt={`QR ${activeTableQr.label}`}
                style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }}
              />
            </div>

            <div
              style={{
                width: '100%',
                backgroundColor: 'var(--bento-hueso)',
                padding: '10px 14px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-border)',
                marginBottom: '20px',
                wordBreak: 'break-all',
                fontSize: '0.8rem',
                color: 'var(--bento-text)',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '2px',
                  color: 'var(--bento-text)',
                }}
              >
                Enlace de Mesa:
              </span>
              {qrData.url}
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => onRotateQr(activeTableQr)}
                  disabled={qrLoading}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    padding: '10px 16px',
                    backgroundColor: 'var(--bento-tinta)',
                    color: 'var(--bento-papel)',
                    border: '1px solid var(--bento-tinta)',
                    borderRadius: 'var(--bento-pill-radius)',
                    cursor: qrLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  {qrLoading ? 'Rotando...' : 'Rotar QR'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--bento-text)',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
