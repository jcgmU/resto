import React from 'react';

export interface ProgressNodesProps {
  steps: string[];
  /** Índice (0-based) del paso actual. */
  current: number;
  /** Índice (0-based) del tramo entre steps[i] y steps[i+1] que tiene problemas. */
  problemSegment?: number;
  className?: string;
}

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

export function ProgressNodes({ steps, current, problemSegment, className }: ProgressNodesProps) {
  return (
    <ol
      data-component="progress-nodes"
      className={className}
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', alignItems: 'flex-start', width: '100%' }}
    >
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending';
        const isLast = i === steps.length - 1;
        const problem = problemSegment === i;
        return (
          <React.Fragment key={label}>
            <li
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', position: 'relative' }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: 'var(--bento-pill-radius)',
                  boxSizing: 'border-box',
                  background: state === 'pending' ? 'var(--bento-card-bg-solid)' : 'var(--bento-primary)',
                  border: '2px solid var(--bento-primary)',
                  boxShadow: state === 'current' ? '0 0 0 3px var(--bento-primary)' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: state === 'current' ? 700 : 500,
                  color: state === 'pending' ? 'var(--bento-text-muted)' : 'var(--bento-text)',
                }}
              >
                {label}
              </span>
              {problem ? <span style={SR_ONLY}>Con problemas</span> : null}
            </li>
            {isLast ? null : (
              <span
                aria-hidden="true"
                data-component="progress-segment"
                data-problem={problem ? 'true' : undefined}
                style={{
                  flex: 1,
                  height: '2px',
                  marginTop: '7px',
                  '--kit-segment-bg': problem
                    ? 'var(--bento-destructive)'
                    : i < current
                    ? 'var(--bento-primary)'
                    : 'var(--bento-border)',
                  background: 'var(--kit-segment-bg)',
                } as React.CSSProperties}
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
