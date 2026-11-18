import React from 'react';

export interface AvailabilityToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  onLabel?: string;
  offLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AvailabilityToggle({
  checked,
  onChange,
  label,
  onLabel = 'Disponible',
  offLabel = 'No disponible',
  className,
  style,
}: AvailabilityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-component="availability-toggle"
      data-state={checked ? 'on' : 'off'}
      onClick={() => onChange(!checked)}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'var(--bento-touch-target)',
        padding: '0 16px',
        cursor: 'pointer',
        borderRadius: 'var(--bento-inner-radius)',
        backgroundColor: checked ? 'var(--bento-status-available-bg)' : 'var(--bento-status-neutral-bg)',
        color: checked ? 'var(--bento-status-available-text)' : 'var(--bento-text-muted)',
        border: 'none',
        fontFamily: 'var(--bento-font-body)',
        fontSize: '0.875rem',
        fontWeight: 600,
        transition: 'background-color 0.2s ease, color 0.2s ease',
        ...style,
      }}
    >
      <span>{checked ? onLabel : offLabel}</span>
    </button>
  );
}
