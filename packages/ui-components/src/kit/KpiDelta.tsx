import React from 'react';

export type KpiTrend = 'up' | 'down' | 'neutral';

export interface KpiDeltaProps {
  label: string;
  value: string;
  delta?: string;
  trend?: KpiTrend;
  context?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function KpiDelta({ label, value, delta, trend = 'up', context, className, style }: KpiDeltaProps) {
  const isUp = trend === 'up';
  const isNeutral = trend === 'neutral';
  return (
    <div
      data-component="kpi-delta"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}
    >
      <span
        style={{
          color: 'var(--bento-text-muted)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--bento-font-heading)',
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: 1.1,
            color: 'var(--bento-text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {delta ? (
          <span
            data-component="kpi-delta-chip"
            data-trend={trend}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--bento-pill-radius)',
              fontSize: '12px',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              '--kit-chip-bg': isUp
                ? 'var(--bento-status-available)'
                : isNeutral
                ? 'var(--bento-page-bg)'
                : 'var(--bento-destructive)',
              background: 'var(--kit-chip-bg)',
              '--kit-chip-fg': isNeutral
                ? 'var(--bento-text)'
                : isUp
                ? 'var(--bento-status-available-strong)'
                : 'var(--bento-card-bg-solid)',
              color: 'var(--kit-chip-fg)',
            } as React.CSSProperties}
          >
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isNeutral ? (
                <line x1="2" y1="6" x2="10" y2="6" />
              ) : isUp ? (
                <path d="M2 8l4-4 4 4" />
              ) : (
                <path d="M2 4l4 4 4-4" />
              )}
            </svg>
            <span
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }}
            >
              {isNeutral ? 'Sin cambio' : isUp ? 'Aumentó' : 'Disminuyó'}
            </span>
            <span>{delta}</span>
          </span>
        ) : null}
      </div>
      {context ? <span style={{ color: 'var(--bento-text-muted)', fontSize: '12px' }}>{context}</span> : null}
    </div>
  );
}
