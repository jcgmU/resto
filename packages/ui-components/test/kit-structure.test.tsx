import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarRail } from '../src/kit/SidebarRail';
import { PageHeader } from '../src/kit/PageHeader';
import { TabsPill } from '../src/kit/TabsPill';
import { StatusChip } from '../src/kit/StatusChip';
import { BENTO_STYLESHEET } from '../src/bento/tokens';

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12h16" />
  </svg>
);

describe('SidebarRail', () => {
  const items = [
    { id: 'dash', label: 'Dashboard', icon, href: '/dashboard' },
    { id: 'kds', label: 'KDS', icon, href: '/kds', badge: 3 },
    { id: 'zero', label: 'Mesas', icon, href: '/mesas', badge: 0 },
  ];

  it('renders a labelled nav with one link per item', () => {
    render(<SidebarRail items={items} activeId="dash" ariaLabel="Principal" />);
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/dashboard');
  });

  it('marks only the active item with aria-current and data-active', () => {
    render(<SidebarRail items={items} activeId="kds" />);
    expect(screen.getByRole('link', { name: /KDS/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /KDS/ })).toHaveAttribute('data-active', 'true');
  });

  it('shows counter badge only when > 0 and exposes it accessibly', () => {
    render(<SidebarRail items={items} activeId="dash" />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /KDS.*3/ })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('caps large badges at 99+', () => {
    render(<SidebarRail items={[{ id: 'a', label: 'A', icon, href: '/a', badge: 150 }]} activeId="a" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    render(<SidebarRail items={items} activeId="dash" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('link', { name: /KDS/ }));
    expect(onSelect).toHaveBeenCalledWith('kds');
  });

  it('defines focus-visible and reduced-motion rules using tokens only', () => {
    const { container } = render(<SidebarRail items={items} activeId="dash" />);
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('var(--bento-accent-strong)');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('PageHeader', () => {
  it('renders greeting as heading and subtitle', () => {
    render(<PageHeader greeting="Hola, Ana" subtitle="Resumen de hoy" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Resumen de hoy')).toBeInTheDocument();
  });

  it('renders search and reports changes', () => {
    const onChange = jest.fn();
    render(
      <PageHeader
        greeting="Hola"
        search={{ value: '', onChange, placeholder: 'Buscar', label: 'Buscar pedidos' }}
      />,
    );
    const input = screen.getByRole('searchbox', { name: 'Buscar pedidos' });
    fireEvent.change(input, { target: { value: 'mesa' } });
    expect(onChange).toHaveBeenCalledWith('mesa');
  });

  it('renders primary action button and fires onClick', () => {
    const onClick = jest.fn();
    render(<PageHeader greeting="Hola" primaryAction={{ label: 'Nuevo pedido', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo pedido' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits search and action when not provided', () => {
    render(<PageHeader greeting="Hola" />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has focus-visible and reduced-motion rules without raw hex', () => {
    const { container } = render(<PageHeader greeting="Hola" />);
    const css = container.querySelector('style')?.textContent ?? '';
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('TabsPill', () => {
  const tabs = [
    { id: 'a', label: 'Todos', count: 5 },
    { id: 'b', label: 'Activos' },
    { id: 'c', label: 'Cerrados' },
  ];

  it('renders tablist with selected tab', () => {
    render(<TabsPill tabs={tabs} value="b" onChange={() => {}} ariaLabel="Filtro" />);
    expect(screen.getByRole('tablist', { name: 'Filtro' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Activos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Activos' })).not.toHaveAttribute('aria-controls');
    expect(screen.getByRole('tab', { name: /Todos/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Todos/ })).not.toHaveAttribute('aria-controls');
  });

  it('assigns aria-controls only when panelId is defined', () => {
    const tabsWithPanel = [
      { id: 't1', label: 'Tab 1', panelId: 'custom-panel-1' },
      { id: 't2', label: 'Tab 2' },
    ];
    render(<TabsPill tabs={tabsWithPanel} value="t1" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-controls', 'custom-panel-1');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).not.toHaveAttribute('aria-controls');
  });

  it('shows counts', () => {
    render(<TabsPill tabs={tabs} value="a" onChange={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onChange on click', () => {
    const onChange = jest.fn();
    render(<TabsPill tabs={tabs} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cerrados' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('supports arrow key navigation with wrap', () => {
    const onChange = jest.fn();
    render(<TabsPill tabs={tabs} value="c" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cerrados' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Cerrados' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('uses roving tabindex', () => {
    render(<TabsPill tabs={tabs} value="b" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Activos' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Cerrados' })).toHaveAttribute('tabindex', '-1');
  });

  it('has focus-visible and reduced-motion rules without raw hex in stylesheet and no inline style', () => {
    const { container } = render(<TabsPill tabs={tabs} value="a" onChange={() => {}} />);
    expect(container.querySelector('style')).toBeNull();
    const tabsCssMatch = BENTO_STYLESHEET.match(/\.bento-tabs\s*\{[\s\S]*?\.bento-tabs__count\s*\{[^}]*\}/);
    expect(tabsCssMatch).toBeTruthy();
    const tabsCss = tabsCssMatch ? tabsCssMatch[0] : '';
    expect(tabsCss).toContain(':focus-visible');
    expect(BENTO_STYLESHEET).toContain('.bento-tabs__tab {\n    transition: none;\n  }');
    expect(tabsCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('StatusChip', () => {
  it('renders label with decorative dot', () => {
    const { container } = render(<StatusChip tone="ok" label="Listo" />);
    expect(screen.getByText('Listo')).toBeInTheDocument();
    expect(container.querySelector('[data-part="dot"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(['ok', 'warning', 'error', 'neutral'] as const)('exposes tone %s', (tone) => {
    render(<StatusChip tone={tone} label={`t-${tone}`} />);
    expect(screen.getByText(`t-${tone}`).closest('[data-component="status-chip"]')).toHaveAttribute(
      'data-tone',
      tone,
    );
  });

  it('defaults to neutral tone', () => {
    render(<StatusChip label="X" />);
    expect(screen.getByText('X').closest('[data-component="status-chip"]')).toHaveAttribute('data-tone', 'neutral');
  });

  it('uses tokens only (no raw hex)', () => {
    const { container } = render(<StatusChip tone="error" label="Retraso" />);
    const chip = container.querySelector('[data-component="status-chip"]') as HTMLElement;
    expect(chip.getAttribute('style') ?? '').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(chip.outerHTML).toContain('var(--bento-');
  });
});
