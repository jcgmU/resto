import React from 'react';
import { buildOrderRoute, formatRouteDuration, OrderRouteEvent, OrderRouteStep } from './routeSteps';

export interface OrderRouteProps {
  status: string;
  events?: readonly OrderRouteEvent[];
  createdAt?: string;
  mode?: 'compact' | 'detail';
  className?: string;
}

const ROUTE_CSS = `
@keyframes kit-route-flow { 0%, 100% { transform: translateX(0); opacity: 0.55; } 50% { transform: translateX(3px); opacity: 1; } }
[data-component="route-arrow"][data-active="true"] { animation: kit-route-flow 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { [data-component="route-arrow"][data-active="true"] { animation: none; } }
`;

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

const DOT_BACKGROUND: Record<OrderRouteStep['state'], string> = {
  done: 'var(--bento-primary)',
  current: 'var(--bento-primary)',
  pending: 'transparent',
  cancelled: 'var(--bento-destructive)',
};

const DOT_BORDER: Record<OrderRouteStep['state'], string> = {
  done: 'var(--bento-primary)',
  current: 'var(--bento-primary)',
  pending: 'var(--bento-text-muted)',
  cancelled: 'var(--bento-destructive)',
};

const NOWRAP: React.CSSProperties = { whiteSpace: 'nowrap' };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function labelColor(state: OrderRouteStep['state']): string {
  if (state === 'cancelled') return 'var(--bento-destructive)';
  return state === 'pending' ? 'var(--bento-text-muted)' : 'var(--bento-text)';
}

function Dot({ state, size = 14 }: { state: OrderRouteStep['state']; size?: number }) {
  return (
    <span
      aria-hidden="true"
      data-component="route-dot"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        borderRadius: 'var(--bento-pill-radius)',
        boxSizing: 'border-box',
        background: DOT_BACKGROUND[state],
        borderWidth: '2px',
        borderStyle: 'solid',
        '--route-dot-border': DOT_BORDER[state],
        borderColor: 'var(--route-dot-border)',
        boxShadow: state === 'current' ? '0 0 0 3px var(--bento-border)' : 'none',
      } as React.CSSProperties}
    />
  );
}

export function OrderRoute({ status, events, createdAt, mode = 'compact', className }: OrderRouteProps) {
  const steps = buildOrderRoute(status, events, { createdAt });
  const detail = mode === 'detail';

  return (
    <>
      <style>{ROUTE_CSS}</style>
      <ol
        data-component="order-route"
        aria-label="Ruta del plato"
        className={className}
        style={
          detail
            ? { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }
            : { listStyle: 'none', margin: 0, padding: '0 0 18px', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, overflow: 'visible', boxSizing: 'border-box' }
        }
      >
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const emphasized = step.state === 'current' || step.state === 'cancelled';
          const label = step.state === 'cancelled' ? `${step.label} · Cancelado` : step.label;
          const labelStyle: React.CSSProperties = {
            ...NOWRAP,
            fontSize: '11px',
            fontWeight: emphasized ? 700 : 500,
            color: labelColor(step.state),
          };

          if (detail) {
            return (
              <li
                key={step.status}
                data-state={step.state}
                aria-current={step.state === 'current' ? 'step' : undefined}
                style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto', columnGap: '8px', alignItems: 'start' }}
              >
                <span style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Dot state={step.state} />
                  {isLast ? null : (
                    <span
                      aria-hidden="true"
                      data-component="route-line"
                      style={{ flex: 1, width: '2px', minHeight: '14px', background: 'var(--bento-text-muted)', opacity: step.state === 'pending' ? 0.4 : 1 }}
                    />
                  )}
                </span>
                <span style={{ ...labelStyle, lineHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                <span style={{ ...NOWRAP, display: 'flex', gap: '8px', justifyContent: 'flex-end', lineHeight: '14px', fontSize: '10px', color: 'var(--bento-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {step.at ? <span data-component="route-time">{formatTime(step.at)}</span> : null}
                  {step.durationMs !== undefined ? (
                    <span data-component="route-duration" style={NOWRAP}>
                      {formatRouteDuration(step.durationMs)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          }

          const nextPending = steps[i + 1]?.state === 'pending';
          const labelPosition: React.CSSProperties =
            i === 0 ? { left: 0 } : isLast ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };
          return (
            <li
              key={step.status}
              data-state={step.state}
              aria-current={step.state === 'current' ? 'step' : undefined}
              style={{ flex: isLast ? '0 1 auto' : '1 1 0', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                <Dot state={step.state} size={12} />
                <span
                  data-label="true"
                  data-sr-only={emphasized ? undefined : 'true'}
                  style={emphasized ? { ...labelStyle, position: 'absolute', top: '100%', marginTop: '3px', ...labelPosition } : SR_ONLY}
                >
                  {label}
                </span>
              </span>
              {isLast ? null : (
                <svg
                  aria-hidden="true"
                  data-component="route-arrow"
                  data-active={step.state === 'current' ? 'true' : undefined}
                  viewBox="0 0 24 24"
                  preserveAspectRatio="none"
                  fill="none"
                  stroke={nextPending || step.state === 'cancelled' ? 'var(--bento-text-muted)' : 'var(--bento-primary)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flex: '1 1 auto', minWidth: 0, maxWidth: '14px', height: '12px' }}
                >
                  <path d="M3 12h18M14 5l7 7-7 7" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
