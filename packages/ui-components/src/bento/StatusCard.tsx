import React from 'react';

export type StatusCardStatus = 'available' | 'occupied' | 'reserved' | 'neutral';
export type StatusCardVariant = 'solid' | 'progress';

export interface StatusCardProps extends React.HTMLAttributes<HTMLElement> {
  status: StatusCardStatus;
  variant?: StatusCardVariant;
  /** Solo para variant="progress": 0 a 1. */
  progress?: number;
  /** false apaga la vuelta del blob (queda en la esquina superior izquierda). */
  animate?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}

const BLOB_COLOR: Record<StatusCardStatus, string> = {
  available: 'var(--bento-status-available)',
  occupied: 'var(--bento-status-occupied)',
  reserved: 'var(--bento-status-reserved)',
  neutral: 'var(--bento-status-disabled)',
};

export function StatusCard({
  status,
  variant = 'solid',
  progress = 0,
  animate = true,
  interactive,
  children,
  className,
  style,
  ...rest
}: StatusCardProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const blobStyle: React.CSSProperties = {
    ['--bento-blob-color' as string]: BLOB_COLOR[status],
    ...(variant === 'progress' ? { width: `${Math.round(clamped * 100)}%` } : {}),
  };

  return (
    <article
      data-component="status-card"
      data-status={status}
      data-animated={animate ? 'true' : 'false'}
      data-interactive={interactive ? 'true' : undefined}
      className={['bento-status-card', className].filter(Boolean).join(' ')}
      style={{ cursor: interactive ? 'pointer' : undefined, ...style }}
      {...rest}
    >
      <span data-part="blob" data-variant={variant} className="bento-status-card__blob" aria-hidden="true" style={blobStyle} />
      <div data-part="body" className="bento-status-card__body">
        {children}
      </div>
    </article>
  );
}
