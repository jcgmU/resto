import React from 'react';

export interface PageHeaderProps {
  greeting: string;
  subtitle?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
  };
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  className?: string;
}

const CSS = `
.bento-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--bento-grid-gap);color:var(--bento-text);font-family:var(--bento-font-body)}
.bento-header__title{margin:0;font-family:var(--bento-font-heading);font-size:1.75rem;line-height:1.15;font-weight:300;letter-spacing:-0.02em}
.bento-header__subtitle{margin:0.25rem 0 0;font-size:0.875rem;color:var(--bento-text-muted)}
.bento-header__tools{display:flex;align-items:center;gap:0.75rem}
.bento-header__search{display:flex;align-items:center;gap:0.5rem;min-height:2.75rem;box-sizing:border-box;padding:0 1rem;border:1px solid var(--bento-border);border-radius:var(--bento-pill-radius);background:rgba(255,255,255,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:var(--bento-text-muted)}
.bento-header__search:focus-within{outline:var(--bento-focus-ring);outline-offset:2px}
.bento-header__search svg,.bento-header__btn svg{width:1.125rem;height:1.125rem;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.bento-header__input{border:0;outline:none;background:transparent;color:var(--bento-text);font:inherit;font-size:0.875rem;min-width:12rem}
.bento-header__btn{display:inline-flex;align-items:center;gap:0.5rem;min-height:2.75rem;padding:0 1.25rem;border:0;border-radius:var(--bento-pill-radius);background:var(--bento-primary, var(--bento-tinta));color:var(--bento-card-bg-solid, var(--bento-papel));font:inherit;font-size:0.875rem;font-weight:500;cursor:pointer;transition:transform .15s ease,opacity .15s ease,background-color .15s ease}
.bento-header__btn:hover{background:var(--bento-primary-hover);transform:scale(var(--bento-hover-scale))}
.bento-header__btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.bento-header__btn:focus-visible{outline:var(--bento-focus-ring);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.bento-header__btn{transition:none}.bento-header__btn:hover{transform:none}}
`;

const SearchIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export function PageHeader({ greeting, subtitle, search, primaryAction, className }: PageHeaderProps) {
  return (
    <header data-component="page-header" className={['bento-header', className].filter(Boolean).join(' ')}>
      <style>{CSS}</style>
      <div>
        <h1 className="bento-header__title">{greeting}</h1>
        {subtitle && <p className="bento-header__subtitle">{subtitle}</p>}
      </div>
      {(search || primaryAction) && (
        <div className="bento-header__tools">
          {search && (
            <label className="bento-header__search">
              {SearchIcon}
              <input
                type="search"
                className="bento-header__input"
                aria-label={search.label ?? search.placeholder ?? 'Buscar'}
                placeholder={search.placeholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
              />
            </label>
          )}
          {primaryAction && (
            <button
              type="button"
              className="bento-header__btn"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
