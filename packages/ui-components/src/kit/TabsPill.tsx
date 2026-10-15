import React from 'react';

export interface TabsPillItem {
  id: string;
  label: string;
  count?: number;
  panelId?: string;
}

export interface TabsPillProps {
  tabs: TabsPillItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function TabsPill({ tabs, value, onChange, ariaLabel, className }: TabsPillProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(tabs.length - 1, 0);
    }
  };

  return (
    <div
      data-component="tabs-pill"
      role="tablist"
      aria-label={ariaLabel}
      className={['bento-tabs', className].filter(Boolean).join(' ')}
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.panelId || undefined}
            tabIndex={selected ? 0 : -1}
            className="bento-tabs__tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
            {typeof tab.count === 'number' && <span className="bento-tabs__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
