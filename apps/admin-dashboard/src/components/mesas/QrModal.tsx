import { Modal } from '@packages/ui-components';
import React from 'react';
import { TableItem, TableQrData } from './types';

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

  if (!activeTableQr) return null;

  return (
    <Modal open={true} title={`Código QR — ${activeTableQr.label}`} onClose={onClose} maxWidth="460px" footer={<></>}>
        {qrError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bento-card-bg-solid)',
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
                backgroundColor: 'var(--bento-card-bg-solid)',
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
                backgroundColor: 'var(--bento-panel-bg)',
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
                    backgroundColor: 'var(--bento-primary)',
                    color: 'var(--bento-card-bg-solid)',
                    border: '1px solid var(--bento-border)',
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
    </Modal>
  );
}
