import React from 'react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const STYLES = `
[data-component="error-state"] button:focus-visible { outline: var(--bento-focus-ring); outline-offset: 2px; }
`;

export function ErrorState({ title = 'Algo salió mal', message, onRetry, retryLabel = 'Reintentar', className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-component="error-state"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
        padding: '32px 24px',
        border: '1px solid var(--bento-destructive)',
        borderRadius: 'var(--bento-card-radius)',
        background: 'var(--bento-card-bg-solid)',
        color: 'var(--bento-text)',
      }}
    >
      <style>{STYLES}</style>
      <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        stroke="var(--bento-destructive)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="20" cy="20" r="14" />
        <path d="M20 12v10M20 27v1" />
      </svg>
      <h3 style={{ margin: 0, fontSize: '16px', fontFamily: 'var(--bento-font-heading)' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--bento-text-muted)' }}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '8px',
            minHeight: '44px',
            padding: '0 20px',
            borderRadius: 'var(--bento-pill-radius)',
            background: 'var(--bento-primary)',
            color: 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-primary)',
            fontFamily: 'var(--bento-font-body)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
