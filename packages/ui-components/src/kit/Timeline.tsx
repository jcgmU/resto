import React from 'react';

export type TimelineTone = 'success' | 'warning' | 'destructive' | 'neutral';

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  tone?: TimelineTone;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const TONE_COLOR: Record<TimelineTone, string> = {
  success: 'var(--bento-success)',
  warning: 'var(--bento-amber)',
  destructive: 'var(--bento-destructive)',
  neutral: 'var(--bento-accent-strong)',
};

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol
      data-component="timeline"
      className={className}
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
    >
      {items.map((item, i) => {
        const tone = item.tone ?? 'neutral';
        const isLast = i === items.length - 1;
        return (
          <li key={item.id} style={{ display: 'flex', gap: '12px', position: 'relative', paddingBottom: isLast ? 0 : '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                data-component="timeline-dot"
                data-tone={tone}
                style={{
                  width: '10px',
                  height: '10px',
                  marginTop: '5px',
                  borderRadius: 'var(--bento-pill-radius)',
                  background: TONE_COLOR[tone],
                  flexShrink: 0,
                }}
              />
              {isLast ? null : (
                <span style={{ flex: 1, width: '1px', marginTop: '4px', background: 'var(--bento-border)' }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <time
                style={{
                  fontSize: '11px',
                  color: 'var(--bento-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.05em',
                }}
              >
                {item.time}
              </time>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--bento-text)' }}>{item.title}</span>
              {item.description ? (
                <span style={{ fontSize: '13px', color: 'var(--bento-text-muted)' }}>{item.description}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
