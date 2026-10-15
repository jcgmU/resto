import React from 'react';

export type StatusChipTone = 'ok' | 'warning' | 'error' | 'neutral';

export interface StatusChipProps {
  label: string;
  tone?: StatusChipTone;
  className?: string;
}

// Estados pastel con texto oscuro con contraste AA verificado (Suite)
const TONES: Record<StatusChipTone, { dot: string; bg: string; fg: string }> = {
  ok: {
    dot: 'var(--bento-status-available)',
    bg: 'var(--bento-status-available-bg, rgba(143, 191, 149, 0.2))',
    fg: 'var(--bento-status-available-text)',
  },
  warning: {
    dot: 'var(--bento-status-reserved)',
    bg: 'var(--bento-status-reserved-bg, rgba(220, 201, 138, 0.2))',
    fg: 'var(--bento-status-reserved-text)',
  },
  error: {
    dot: 'var(--bento-status-occupied)',
    bg: 'var(--bento-status-occupied-bg, rgba(224, 166, 166, 0.2))',
    fg: 'var(--bento-status-occupied-text)',
  },
  neutral: {
    dot: 'var(--bento-text-muted)',
    bg: 'var(--bento-status-neutral-bg, var(--bento-card-bg))',
    fg: 'var(--bento-text)',
  },
};

export function StatusChip({ label, tone = 'neutral', className }: StatusChipProps) {
  const t = TONES[tone];
  return (
    <span
      data-component="status-chip"
      data-tone={tone}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.125rem 0.625rem',
        borderRadius: 'var(--bento-pill-radius)',
        border: '1px solid var(--bento-border)',
        background: t.bg,
        color: t.fg,
        fontFamily: 'var(--bento-font-body)',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <span
        data-part="dot"
        aria-hidden="true"
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: 'var(--bento-pill-radius)',
          background: t.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
