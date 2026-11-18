import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../src/kit/Modal';

const originalMatchMedia = window.matchMedia;

function setTouchTablet(enabled: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      media: query,
      matches: enabled && query.includes('1024px') && query.includes('pointer: coarse'),
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

const isInert = (el: Element | null) => !!el && el.hasAttribute('inert');
const backdropOf = (name: string) => screen.getByRole('dialog', { name }).closest('[data-testid="modal-backdrop"]');

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
});

function Harness({ scrim = true }: { scrim?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <main data-testid="page">
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal open={open} title="Uno" onClose={() => setOpen(false)} scrim={scrim} primaryLabel="Guardar" />
    </main>
  );
}

describe('inert', () => {
  test('con scrim el resto de la página queda inert y se restaura al cerrar', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByText('Abrir'));
    expect(isInert(container)).toBe(true);
    expect(isInert(backdropOf('Uno'))).toBe(false);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(isInert(container)).toBe(false);
  });

  test('conserva lo que ya era inert antes de abrir', () => {
    const outside = document.createElement('div');
    outside.setAttribute('inert', '');
    document.body.appendChild(outside);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByText('Abrir'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(isInert(outside)).toBe(true);
    expect(isInert(container)).toBe(false);
    outside.remove();
  });

  test('sin scrim (inspector) no hay inert ni bloqueo de scroll', () => {
    const { container } = render(<Harness scrim={false} />);
    fireEvent.click(screen.getByText('Abrir'));
    expect(isInert(container)).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  test('en sheet (tablet táctil) también bloquea la página', () => {
    setTouchTablet(true);
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByText('Abrir'));
    expect(screen.getByRole('dialog', { name: 'Uno' })).toHaveAttribute('data-mode', 'sheet');
    expect(isInert(container)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('pila: solo el de arriba es interactivo y la página sigue bloqueada hasta cerrar el último', () => {
    function Stack() {
      const [lower, setLower] = useState(true);
      const [upper, setUpper] = useState(true);
      return (
        <main>
          <Modal open={lower} title="Inferior" onClose={() => setLower(false)} />
          <Modal open={upper} title="Superior" onClose={() => setUpper(false)} />
        </main>
      );
    }
    const { container } = render(<Stack />);
    expect(isInert(container)).toBe(true);
    expect(isInert(backdropOf('Superior'))).toBe(false);
    expect(isInert(backdropOf('Inferior'))).toBe(true);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Superior' })).toBeNull();
    expect(isInert(backdropOf('Inferior'))).toBe(false);
    expect(isInert(container)).toBe(true);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(isInert(container)).toBe(false);
  });
});

describe('bloqueo de scroll', () => {
  test('bloquea html y body, compensa la barra y restaura los valores previos', () => {
    document.body.style.overflow = 'scroll';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1015 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
    render(<Harness />);
    fireEvent.click(screen.getByText('Abrir'));
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('15px');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.body.style.paddingRight).toBe('');
  });

  test('anidado: se mantiene hasta cerrar el último modal', () => {
    function Stack() {
      const [lower, setLower] = useState(true);
      const [upper, setUpper] = useState(true);
      return (
        <>
          <Modal open={lower} title="Inferior" onClose={() => setLower(false)} />
          <Modal open={upper} title="Superior" onClose={() => setUpper(false)} />
        </>
      );
    }
    render(<Stack />);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });
});

describe('foco', () => {
  test('entra al primer control, Tab y Shift+Tab ciclan dentro y vuelve al disparador', () => {
    render(<Harness />);
    const trigger = screen.getByText('Abrir');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Uno' });
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
    expect(document.activeElement).toBe(buttons[0]);

    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(buttons[buttons.length - 1], { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  test('el foco vuelve al disparador del modal de abajo al cerrar el de arriba', async () => {
    function Stack() {
      const [upper, setUpper] = useState(false);
      return (
        <>
          <Modal open title="Inferior" onClose={() => undefined} footer={<button onClick={() => setUpper(true)}>Abrir superior</button>} />
          <Modal open={upper} title="Superior" onClose={() => setUpper(false)} />
        </>
      );
    }
    render(<Stack />);
    const opener = screen.getByText('Abrir superior');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await Promise.resolve();
    expect(document.activeElement).toBe(opener);
  });
});
