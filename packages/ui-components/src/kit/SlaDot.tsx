import React, { useEffect, useState, useMemo } from 'react';

export interface SlaDotProps {
  createdAt: string | Date;
  estimatedPrepMinutes?: number;
  delayMinutes?: number;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export type SlaTone = 'green' | 'yellow' | 'red';

export function computeSlaStatus(
  createdAt: string | Date,
  estimatedPrepMinutes = 18,
  delayMinutes = 0,
  nowMs = Date.now()
): {
  tone: SlaTone;
  elapsedMinutes: number;
  effectiveSlaMinutes: number;
  percentage: number;
} {
  const createdMs = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  const effectiveSlaMinutes = Math.max(1, (estimatedPrepMinutes || 18) + (delayMinutes || 0));
  const elapsedMinutes = Math.max(0, (nowMs - createdMs) / 60000);
  const percentage = elapsedMinutes / effectiveSlaMinutes;

  let tone: SlaTone = 'green';
  if (percentage >= 1.0) {
    tone = 'red';
  } else if (percentage >= 0.75) {
    tone = 'yellow';
  }

  return {
    tone,
    elapsedMinutes,
    effectiveSlaMinutes,
    percentage,
  };
}

export function SlaDot({
  createdAt,
  estimatedPrepMinutes = 18,
  delayMinutes = 0,
  size = '10px',
  className,
  style,
}: SlaDotProps) {
  // Tick cada 30 segundos del lado del cliente
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const { tone, elapsedMinutes, effectiveSlaMinutes } = useMemo(() => {
    return computeSlaStatus(createdAt, estimatedPrepMinutes, delayMinutes, now);
  }, [createdAt, estimatedPrepMinutes, delayMinutes, now]);

  const dotColor =
    tone === 'red'
      ? 'var(--bento-status-occupied, #dc3545)'
      : tone === 'yellow'
      ? 'var(--bento-status-reserved, #ffc107)'
      : 'var(--bento-status-available, #28a745)';

  const label =
    tone === 'red'
      ? `Demorado (${Math.round(elapsedMinutes)}/${effectiveSlaMinutes} min)`
      : tone === 'yellow'
      ? `Atención (${Math.round(elapsedMinutes)}/${effectiveSlaMinutes} min)`
      : `A tiempo (${Math.round(elapsedMinutes)}/${effectiveSlaMinutes} min)`;

  return (
    <span
      data-testid="sla-dot"
      data-tone={tone}
      title={label}
      aria-label={label}
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 'var(--bento-pill-radius, 9999px)',
        backgroundColor: dotColor,
        boxShadow: tone === 'red' ? '0 0 6px var(--bento-status-occupied, #dc3545)' : 'none',
        flexShrink: 0,
        transition: 'background-color 0.3s ease',
        ...style,
      }}
    />
  );
}
