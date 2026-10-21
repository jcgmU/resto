export const BENTO_TOKENS: Record<string, string> = {
  // Estructura y fondos Suite
  '--bento-page-bg': '#d0d3d6',
  '--bento-page-bg-pwa': '#f2f4f5',
  '--bento-card-bg': 'rgba(255, 255, 255, 0.65)',
  '--bento-card-bg-solid': '#ffffff',
  '--bento-card-radius': '2rem',
  '--bento-card-padding': '24px',
  '--bento-inner-radius': '1.5rem',
  '--bento-pill-radius': '9999px',
  '--bento-grid-gap': '16px',
  '--bento-card-shadow': '4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)',
  '--bento-hover-scale': '1.02',

  // Textos y bordes Suite
  '--bento-text': '#3a3c3e',
  '--bento-text-muted': '#666666',
  '--bento-border': 'rgba(255, 255, 255, 0.6)',

  // Marca y acciones primarias Suite
  '--bento-primary': '#5c6784',
  '--bento-primary-hover': '#4a536b',
  '--bento-accent': '#5c6784',
  '--bento-accent-strong': '#1d1f22',
  '--bento-info': '#a5b9c6',

  // Rail lateral flotante oscuro Suite
  '--bento-rail-bg': '#1d1f22',
  '--bento-rail-active': '#a5b9c6',
  '--bento-rail-inactive': '#6b7280',

  // Estados pastel y textos asociados con contraste AA
  '--bento-status-occupied': '#e0a6a6',
  '--bento-status-occupied-text': '#7a3030',
  '--bento-status-occupied-bg': 'rgba(224, 166, 166, 0.2)',
  '--bento-status-reserved': '#dcc98a',
  '--bento-status-reserved-text': '#8a6b32',
  '--bento-status-reserved-bg': 'rgba(220, 201, 138, 0.2)',
  '--bento-status-available': '#8fbf95',
  '--bento-status-available-text': '#527a55',
  '--bento-status-available-bg': 'rgba(143, 191, 149, 0.2)',
  '--bento-status-neutral-bg': 'rgba(255, 255, 255, 0.65)',

  // Semánticos generales (compatibilidad)
  '--bento-amber': '#dcc98a',
  '--bento-amber-strong': '#8a6b32',
  '--bento-warning': 'var(--bento-status-reserved)',
  '--bento-success': 'var(--bento-status-available)',
  '--bento-destructive': 'var(--bento-status-occupied)',

  // Notas, paneles y superficies funcionales Suite
  '--bento-note-item-bg': '#fbeaea',
  '--bento-note-item-border': 'rgba(122, 48, 48, 0.2)',
  '--bento-note-general-bg': '#fdf6e7',
  '--bento-note-general-border': 'rgba(138, 107, 50, 0.2)',
  '--bento-panel-bg': 'rgba(224, 227, 229, 0.5)',
  '--bento-overlay-dark': 'rgba(34, 34, 34, 0.95)',
  '--bento-subtle': 'rgba(0, 0, 0, 0.03)',

  // Textos y estados extendidos
  '--bento-danger-text': '#a05a5a',
  '--bento-status-reserved-soft-text': '#9a8542',
  '--bento-status-available-strong': '#163318',
  '--bento-status-occupied-strong': '#8a2b2b',
  '--bento-text-strong': '#222222',
  '--bento-text-secondary': '#555555',
  '--bento-status-disabled': '#9ca3af',

  // Foco y tipografía
  '--bento-focus-ring': '2px solid #5c6784',
  '--bento-font-heading': "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)",
  '--bento-font-body': "var(--font-dm-sans, 'DM Sans', sans-serif)",

  // Accesibilidad táctil y espaciados
  '--bento-touch-target': '44px',
  '--bento-touch-gap': '8px',
  '--bento-safe-bottom': 'env(safe-area-inset-bottom)',
  '--bento-spacing-xs': '4px',
  '--bento-spacing-sm': '8px',
  '--bento-spacing-md': '16px',
  '--bento-spacing-lg': '24px',
  '--bento-spacing-xl': '32px',
};

// Nota: packages/ui-components/src/bento/bento.css es la fuente de verdad montada en las apps
export const BENTO_STYLESHEET = `
:root {
  --bento-page-bg: #d0d3d6;
  --bento-page-bg-pwa: #f2f4f5;
  --bento-card-bg: rgba(255, 255, 255, 0.65);
  --bento-card-bg-solid: #ffffff;
  --bento-card-radius: 2rem;
  --bento-card-padding: 24px;
  --bento-inner-radius: 1.5rem;
  --bento-pill-radius: 9999px;
  --bento-grid-gap: 16px;
  --bento-card-shadow: 4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8);
  --bento-hover-scale: 1.02;
  --bento-text: #3a3c3e;
  --bento-text-muted: #666666;
  --bento-border: rgba(255, 255, 255, 0.6);
  --bento-primary: #5c6784;
  --bento-primary-hover: #4a536b;
  --bento-accent: #5c6784;
  --bento-accent-strong: #1d1f22;
  --bento-info: #a5b9c6;
  --bento-rail-bg: #1d1f22;
  --bento-rail-active: #a5b9c6;
  --bento-rail-inactive: #6b7280;
  --bento-status-occupied: #e0a6a6;
  --bento-status-occupied-text: #7a3030;
  --bento-status-occupied-bg: rgba(224, 166, 166, 0.2);
  --bento-status-reserved: #dcc98a;
  --bento-status-reserved-text: #8a6b32;
  --bento-status-reserved-bg: rgba(220, 201, 138, 0.2);
  --bento-status-available: #8fbf95;
  --bento-status-available-text: #527a55;
  --bento-status-available-bg: rgba(143, 191, 149, 0.2);
  --bento-status-neutral-bg: rgba(255, 255, 255, 0.65);
  --bento-amber: #dcc98a;
  --bento-amber-strong: #8a6b32;
  --bento-warning: var(--bento-status-reserved);
  --bento-success: var(--bento-status-available);
  --bento-destructive: var(--bento-status-occupied);
  --bento-note-item-bg: #fbeaea;
  --bento-note-item-border: rgba(122, 48, 48, 0.2);
  --bento-note-general-bg: #fdf6e7;
  --bento-note-general-border: rgba(138, 107, 50, 0.2);
  --bento-panel-bg: rgba(224, 227, 229, 0.5);
  --bento-overlay-dark: rgba(34, 34, 34, 0.95);
  --bento-subtle: rgba(0, 0, 0, 0.03);
  --bento-danger-text: #a05a5a;
  --bento-status-reserved-soft-text: #9a8542;
  --bento-status-available-strong: #163318;
  --bento-status-occupied-strong: #8a2b2b;
  --bento-text-strong: #222222;
  --bento-text-secondary: #555555;
  --bento-status-disabled: #9ca3af;
  --bento-focus-ring: 2px solid #5c6784;
  --bento-font-heading: var(--font-bricolage, 'Bricolage Grotesque', sans-serif);
  --bento-font-body: var(--font-dm-sans, 'DM Sans', sans-serif);
  --bento-touch-target: 44px;
  --bento-touch-gap: 8px;
  --bento-safe-bottom: env(safe-area-inset-bottom);
  --bento-spacing-xs: 4px;
  --bento-spacing-sm: 8px;
  --bento-spacing-md: 16px;
  --bento-spacing-lg: 24px;
  --bento-spacing-xl: 32px;
}

body {
  background-color: var(--bento-page-bg);
  color: var(--bento-text);
  font-family: var(--bento-font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--bento-font-heading);
  font-weight: 300;
}

[data-component="bento-grid"] {
  display: grid;
  gap: var(--bento-grid-gap);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: minmax(160px, auto);
}

@media (max-width: 1024px) {
  [data-component="bento-grid"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  [data-component="bento-grid"] {
    grid-template-columns: 1fr !important;
  }
}

[data-component="bento-card"] {
  border-radius: var(--bento-card-radius);
  box-shadow: var(--bento-card-shadow);
  background-color: var(--bento-card-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--bento-border);
  padding: var(--bento-card-padding, 24px);
  color: var(--bento-text);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

[data-component="bento-card"][data-interactive="true"]:hover {
  transform: scale(var(--bento-hover-scale));
}

[data-component="bento-card"][data-interactive="true"]:focus-visible {
  outline: var(--bento-focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  [data-component="bento-card"],
  [data-component="bento-card"][data-interactive="true"]:hover {
    transition: none !important;
    transform: none !important;
  }
  [data-component="skeleton"] {
    animation: none;
  }
  .bento-tabs__tab {
    transition: none;
  }
}

/* Skeleton */
@keyframes bento-skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

[data-component="skeleton"] {
  animation: bento-skeleton-pulse 1.4s ease-in-out infinite;
}

/* Tabs Pill */
.bento-tabs {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-pill-radius);
  background: var(--bento-card-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: var(--bento-font-body);
}

.bento-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--bento-touch-target);
  padding: 0 1rem;
  border: 0;
  border-radius: var(--bento-pill-radius);
  background: transparent;
  color: var(--bento-text-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.bento-tabs__tab:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--bento-text);
}

.bento-tabs__tab[aria-selected="true"] {
  background: var(--bento-primary);
  color: var(--bento-card-bg-solid);
}

.bento-tabs__tab:focus-visible {
  outline: var(--bento-focus-ring);
  outline-offset: 2px;
}

.bento-tabs__count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
`;
