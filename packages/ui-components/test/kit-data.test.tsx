import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { KpiDelta } from '../src/kit/KpiDelta';
import { ModalConfirm } from '../src/kit/ModalConfirm';
import { Timeline } from '../src/kit/Timeline';
import { ProgressNodes } from '../src/kit/ProgressNodes';
import { Toast } from '../src/kit/Toast';
import { Skeleton } from '../src/kit/Skeleton';
import { EmptyState } from '../src/kit/EmptyState';
import { ErrorState } from '../src/kit/ErrorState';
import { BENTO_STYLESHEET } from '../src/bento/tokens';

describe('KpiDelta', () => {
  it('muestra label, valor tabular y chip lima para delta positivo', () => {
    render(<KpiDelta label="Ventas" value="1,240" delta="+12%" trend="up" context="vs ayer" />);
    expect(screen.getByText('Ventas')).toBeInTheDocument();
    const value = screen.getByText('1,240');
    expect(value.style.fontVariantNumeric).toBe('tabular-nums');
    const chip = screen.getByText('+12%').closest('[data-component="kpi-delta-chip"]') as HTMLElement;
    expect(chip).toHaveAttribute('data-trend', 'up');
    expect(chip.getAttribute('style')).toContain('var(--bento-status-available)');
    expect(chip.getAttribute('style')).toContain('--kit-chip-fg: var(--bento-status-available-strong)');
    expect(screen.getByText('vs ayer')).toBeInTheDocument();
  });

  it('usa chip rojo para delta negativo y texto accesible', () => {
    render(<KpiDelta label="Pedidos" value="30" delta="-5%" trend="down" />);
    const chip = screen.getByText('-5%').closest('[data-component="kpi-delta-chip"]') as HTMLElement;
    expect(chip).toHaveAttribute('data-trend', 'down');
    expect(chip.getAttribute('style')).toContain('var(--bento-destructive)');
    expect(screen.getByText('Disminuyó')).toBeInTheDocument();
  });

  it('sin delta no renderiza chip', () => {
    const { container } = render(<KpiDelta label="Mesas" value="8" />);
    expect(container.querySelector('[data-component="kpi-delta-chip"]')).toBeNull();
  });
});

describe('ModalConfirm', () => {
  const base = {
    title: 'Confirmar cobro',
    current: { label: 'Cuenta actual', value: '$100' },
    proposed: { label: 'Total a cobrar', value: '$110' },
    impacts: [
      { label: 'Método', value: 'CASH' },
      { label: 'Cambio', value: '$0' },
    ],
  };

  it('no renderiza si open es false', () => {
    render(<ModalConfirm {...base} open={false} onApprove={() => {}} onReject={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza dialog accesible con comparación e impacto', () => {
    render(<ModalConfirm {...base} open onApprove={() => {}} onReject={() => {}} onReview={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Confirmar cobro' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Cuenta actual')).toBeInTheDocument();
    expect(screen.getByText('$110')).toBeInTheDocument();
    expect(screen.getByText('CASH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('los botones disparan callbacks y labels son personalizables', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    render(
      <ModalConfirm {...base} open onApprove={onApprove} onReject={onReject} approveLabel="Confirmar cobro" rejectLabel="Cancelar" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cobro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
  });

  it('cierra con Esc y con click en el backdrop', () => {
    const onClose = jest.fn();
    render(<ModalConfirm {...base} open onApprove={() => {}} onReject={() => {}} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('mueve el foco al dialog al abrir y lo restaura al cerrar', () => {
    const Host = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>abrir</button>
          <ModalConfirm {...base} open={open} onApprove={() => {}} onReject={() => {}} onClose={() => setOpen(false)} />
        </>
      );
    };
    render(<Host />);
    const trigger = screen.getByText('abrir');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('atrapa el foco con Tab y Shift+Tab', () => {
    render(<ModalConfirm {...base} open onApprove={() => {}} onReject={() => {}} onReview={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const first = screen.getByRole('button', { name: 'Cancelar' });
    const last = screen.getByRole('button', { name: 'Confirmar' });
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('Timeline', () => {
  it('renderiza lista ordenada con hora y tono semántico', () => {
    render(
      <Timeline
        items={[
          { id: '1', time: '12:01', title: 'Pedido recibido', tone: 'success' },
          { id: '2', time: '12:15', title: 'Retraso', description: 'Cocina saturada', tone: 'destructive' },
        ]}
      />,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('12:15').tagName).toBe('TIME');
    expect(screen.getByText('Cocina saturada')).toBeInTheDocument();
    const dots = document.querySelectorAll('[data-component="timeline-dot"]');
    expect(dots[1]).toHaveAttribute('data-tone', 'destructive');
  });
});

describe('ProgressNodes', () => {
  const steps = ['Recibido', 'En cocina', 'Listo', 'Entregado'];

  it('marca el paso actual y los completados', () => {
    render(<ProgressNodes steps={steps} current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAttribute('data-state', 'done');
    expect(items[1]).toHaveAttribute('data-state', 'current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveAttribute('data-state', 'pending');
  });

  it('pinta en rojo el tramo problemático', () => {
    render(<ProgressNodes steps={steps} current={1} problemSegment={1} />);
    const segments = document.querySelectorAll('[data-component="progress-segment"]');
    expect(segments).toHaveLength(3);
    expect(segments[1]).toHaveAttribute('data-problem', 'true');
    expect((segments[1] as HTMLElement).getAttribute('style')).toContain('var(--bento-destructive)');
    expect(segments[0]).not.toHaveAttribute('data-problem', 'true');
    expect(screen.getByText('Con problemas')).toBeInTheDocument();
  });
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('es un status con pill tinta y check lima', () => {
    render(<Toast message="Cobro registrado" />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Cobro registrado');
    expect(toast.getAttribute('style')).toContain('var(--bento-accent-strong)');
    expect(toast.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('se descarta con el botón y por temporizador', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Listo" onDismiss={onDismiss} duration={3000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe('Skeleton', () => {
  it('es decorativo y expone dimensiones por tokens/props', () => {
    render(<Skeleton width="120px" height="16px" />);
    const el = document.querySelector('[data-component="skeleton"]') as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('16px');
  });

  it('incluye regla prefers-reduced-motion en stylesheet y no inyecta style inline', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('style')).toBeNull();
    expect(BENTO_STYLESHEET).toContain('[data-component="skeleton"]');
    expect(BENTO_STYLESHEET).toContain('[data-component="skeleton"] {\n    animation: none;\n  }');
  });
});

describe('EmptyState', () => {
  it('muestra título, descripción y acción', () => {
    render(<EmptyState title="Sin pedidos" description="Aún no hay pedidos" action={<button>Crear</button>} />);
    expect(screen.getByRole('heading', { name: 'Sin pedidos' })).toBeInTheDocument();
    expect(screen.getByText('Aún no hay pedidos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('es un alert y ofrece reintento', () => {
    const onRetry = jest.fn();
    render(<ErrorState title="Error" message="No se pudo cargar" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin onRetry no muestra botón', () => {
    render(<ErrorState message="Falló" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('kit datos: higiene de tokens', () => {
  const names = ['KpiDelta', 'ModalConfirm', 'Timeline', 'ProgressNodes', 'Toast', 'Skeleton', 'EmptyState', 'ErrorState'];
  it.each(names)('%s no contiene hex sueltos ni emojis', (name) => {
    const src = fs.readFileSync(path.join(__dirname, '../src/kit', `${name}.tsx`), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
