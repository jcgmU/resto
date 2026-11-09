import React from 'react';

export interface KpiValueProps {
  value: string;
  label?: string;
  tone?: 'accent' | 'success' | 'destructive' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
}

export function KpiValue({ value, label, tone = 'neutral', className, style }: KpiValueProps) {
  const isAccent = tone === 'accent';
  const toneColor =
    tone === 'accent'
      ? 'var(--bento-text-strong, var(--bento-text))'
      : tone === 'success'
      ? 'var(--bento-success)'
      : tone === 'destructive'
      ? 'var(--bento-destructive)'
      : 'var(--bento-text)';

  return (
    <div
      data-component="kpi-value"
      data-tone={tone}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            color: 'var(--bento-text-muted)',
            fontSize: '0.8125rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
            lineHeight: 1.2,
            marginBottom: '2px',
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          fontWeight: 700,
          color: toneColor,
          fontFamily: 'var(--bento-font-heading)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: isAccent ? '1.25rem' : '1rem',
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
    </div>
  );
}
