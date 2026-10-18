import React, { useEffect, useId, useRef } from 'react';

export interface ModalConfirmValue {
  label: string;
  value: string;
}

export interface ModalConfirmProps {
  open: boolean;
  title: string;
  current: ModalConfirmValue;
  proposed: ModalConfirmValue;
  impacts?: ModalConfirmValue[];
  onApprove: () => void;
  onReject: () => void;
  onReview?: () => void;
  /** Cierre por Esc / backdrop. Si no se da, se usa onReject. */
  onClose?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  reviewLabel?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STYLES = `
[data-component="modal-confirm"] button:focus-visible { outline: var(--bento-focus-ring); outline-offset: 2px; }
[data-component="modal-confirm"]:focus-visible { outline: none; }
`;

export function ModalConfirm({
  open,
  title,
  current,
  proposed,
  impacts = [],
  onApprove,
  onReject,
  onReview,
  onClose,
  approveLabel = 'Confirmar',
  rejectLabel = 'Cancelar',
  reviewLabel = 'Revisar',
}: ModalConfirmProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = onClose ?? onReject;

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const buttonBase: React.CSSProperties = {
    minHeight: '44px',
    padding: '0 20px',
    borderRadius: 'var(--bento-pill-radius)',
    fontFamily: 'var(--bento-font-body)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div
      data-testid="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'color-mix(in srgb, var(--bento-page-bg) 70%, transparent)',
        zIndex: 1000,
      }}
    >
      <style>{STYLES}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-component="modal-confirm"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bento-card-bg-solid)',
          color: 'var(--bento-text)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-border)',
          boxShadow: 'var(--bento-card-shadow)',
          padding: '24px',
          fontFamily: 'var(--bento-font-body)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: '20px', fontFamily: 'var(--bento-font-heading)' }}>
          {title}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[current, proposed].map((item, i) => (
            <div
              key={item.label}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-border)',
                background: i === 1 ? 'var(--bento-page-bg)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--bento-text-muted)' }}>
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--bento-font-heading)',
                  fontWeight: 700,
                  fontSize: '24px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
        {impacts.length > 0 ? (
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            {impacts.map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderTop: '1px solid var(--bento-border)',
                  fontSize: '14px',
                }}
              >
                <dt style={{ color: 'var(--bento-text-muted)' }}>{row.label}</dt>
                <dd style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onReject}
            style={{
              ...buttonBase,
              background: 'transparent',
              color: 'var(--bento-destructive)',
              border: '1px solid transparent',
            }}
          >
            {rejectLabel}
          </button>
          {onReview ? (
            <button
              type="button"
              onClick={onReview}
              style={{
                ...buttonBase,
                background: 'transparent',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
              }}
            >
              {reviewLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onApprove}
            style={{
              ...buttonBase,
              background: 'var(--bento-primary)',
              color: 'var(--bento-card-bg-solid)',
              border: '1px solid var(--bento-primary)',
            }}
          >
            {approveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
