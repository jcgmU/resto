import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  onDismiss?: () => void;
  /** ms hasta auto-descartar. Sin valor: no se descarta solo. */
  duration?: number;
  className?: string;
}

const STYLES = `
[data-component="toast"] button:focus-visible { outline: 2px solid var(--bento-primary); outline-offset: 2px; }
`;

export function Toast({ message, onDismiss, duration, className }: ToastProps) {
  useEffect(() => {
    if (!duration || !onDismiss) return undefined;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-component="toast"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: 'var(--bento-pill-radius)',
        '--kit-toast-bg': 'var(--bento-accent-strong)',
        background: 'var(--kit-toast-bg)',
        color: 'var(--bento-card-bg-solid)',
        fontFamily: 'var(--bento-font-body)',
        fontSize: '14px',
        boxShadow: 'var(--bento-card-shadow)',
      } as React.CSSProperties}
    >
      <style>{STYLES}</style>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="var(--bento-status-available)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="9" r="7.5" />
        <path d="M5.5 9.25l2.5 2.5 4.5-5" />
      </svg>
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Cerrar notificación"
          onClick={onDismiss}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px',
            margin: '-12px -12px -12px 0',
            background: 'transparent',
            border: 'none',
            color: 'var(--bento-card-bg-solid)',
            cursor: 'pointer',
          }}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
