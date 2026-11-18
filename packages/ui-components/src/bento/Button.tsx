import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--bento-primary)',
    color: 'var(--bento-card-bg-solid)',
  },
  secondary: {
    backgroundColor: 'var(--bento-field-bg)',
    color: 'var(--bento-text-strong)',
  },
  danger: {
    backgroundColor: 'var(--bento-status-occupied-bg)',
    color: 'var(--bento-status-occupied-text)',
  },
  link: {
    backgroundColor: 'transparent',
    color: 'var(--bento-text-strong)',
    textDecoration: 'underline',
    padding: '0 4px',
  },
};

export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  type = 'button',
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      data-component="button"
      data-variant={variant}
      disabled={inactive}
      style={{
        minHeight: 'var(--bento-touch-target)',
        padding: '0 20px',
        border: 'none',
        borderRadius: 'var(--bento-pill-radius)',
        fontFamily: 'var(--bento-font-body)',
        fontSize: '0.875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: inactive ? 'not-allowed' : 'pointer',
        opacity: inactive ? 0.6 : 1,
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
