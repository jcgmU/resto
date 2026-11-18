import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../src/kit/Modal';

const InspectorModal = Modal as React.ComponentType<React.ComponentProps<typeof Modal> & { scrim: boolean }>;

test.each([false, true])('inspector sin scrim permite interacción exterior (táctil=%s)', (touch) => {
  const oldMatchMedia = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: touch && query.includes('pointer: coarse'), media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return true; }, onchange: null,
  }) });
  const close = jest.fn();
  const outside = jest.fn();
  const view = render(<><button onClick={outside}>Plano</button><InspectorModal open title="Mesa" onClose={close} scrim={false}><button>Detalle</button></InspectorModal></>);
  const dialog = screen.getByRole('dialog', { name: 'Mesa' });
  expect(dialog).toHaveAttribute('aria-modal', 'false');
  expect(screen.getByTestId('modal-backdrop')).toHaveClass('bento-modal__backdrop--nonmodal');
  expect(screen.getByTestId('modal-backdrop')).toHaveStyle({ pointerEvents: 'none' });
  expect(dialog).toHaveStyle({ pointerEvents: 'auto' });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Plano' }));
  expect(outside).toHaveBeenCalledTimes(1);
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  screen.getByRole('button', { name: 'Cancelar' }).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  view.unmount();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: oldMatchMedia });
});

test('los formularios mantienen scrim y semántica modal', () => {
  render(<Modal open title="Editar" onClose={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'Editar' })).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByTestId('modal-backdrop')).not.toHaveClass('bento-modal__backdrop--nonmodal');
});

test('el inspector devuelve el foco al control que lo abrió', () => {
  function Example() {
    const [open, setOpen] = React.useState(false);
    return <><button onClick={() => setOpen(true)}>Consultar</button><Modal open={open} scrim={false} title="Mesa" onClose={() => setOpen(false)} /></>;
  }
  render(<Example />);
  const trigger = screen.getByRole('button', { name: 'Consultar' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Mesa' }).contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(trigger).toHaveFocus();
});
