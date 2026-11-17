import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../src/kit/Modal';
import { shouldDismissSheet } from '../src/kit/BottomSheet';

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

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
});

test('en tablet táctil presenta el formulario como sheet con foco y scrim', () => {
  setTouchTablet(true);
  render(<Modal open title="Editar" onClose={() => {}}><input aria-label="Nombre" /></Modal>);
  const dialog = screen.getByRole('dialog', { name: 'Editar' });
  expect(dialog).toHaveAttribute('data-mode', 'sheet');
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(screen.getByTestId('modal-backdrop').parentElement).toBe(document.body);
});

test('en escritorio conserva el modal centrado', () => {
  setTouchTablet(false);
  render(<Modal open title="Editar" onClose={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'Editar' })).toHaveAttribute('data-mode', 'modal');
});

test('Escape cierra el sheet táctil', () => {
  setTouchTablet(true);
  const onClose = jest.fn();
  render(<Modal open title="Editar" onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Editar' })).toHaveAttribute('data-mode', 'sheet');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('el umbral de arrastre hacia abajo acepta distancia o velocidad', () => {
  expect(shouldDismissSheet(101, 0)).toBe(true);
  expect(shouldDismissSheet(10, 501)).toBe(true);
  expect(shouldDismissSheet(100, 500)).toBe(false);
  expect(shouldDismissSheet(-150, -600)).toBe(false);
});

test('desplazar el contenido del formulario no cierra el sheet', () => {
  setTouchTablet(true);
  const onClose = jest.fn();
  render(<Modal open title="Editar" onClose={onClose}><input aria-label="Nombre" /></Modal>);
  const input = screen.getByRole('textbox', { name: 'Nombre' });
  fireEvent.pointerDown(input, { clientY: 100 });
  fireEvent.pointerMove(input, { clientY: 300 });
  fireEvent.pointerUp(input, { clientY: 300 });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('bottom-sheet-handle')).toBeTruthy();
});
