import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductDetailSheet } from '../src/components/ProductDetailSheet';
import { CartSheet } from '../src/components/cart/CartSheet';
import { CartSummaryBar } from '../src/components/cart/CartSummaryBar';
import { QuantityStepper } from '../src/components/cart/QuantityStepper';
import { CartFab } from '../src/components/cart/CartFab';

const product = { id: 'p1', name: 'Sopa', price: 5000, categoryId: 'c1', tenantId: 't1', isAvailable: true, sortOrder: 0, modifierGroups: [] } as any;

test('detalle de producto usa Modal compartido y cierra con Escape', () => {
  const close = jest.fn();
  render(<ProductDetailSheet product={product} isOpen onClose={close} />);
  const dialog = screen.getByRole('dialog', { name: 'Sopa' });
  expect(dialog).toHaveAttribute('data-component', 'modal');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('carrito usa Modal compartido y cierra con Escape', () => {
  const close = jest.fn();
  render(<CartSheet isOpen onClose={close} />);
  const dialog = screen.getByRole('dialog', { name: 'Tu Carrito' });
  expect(dialog).toHaveAttribute('data-component', 'modal');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});

test('las acciones del carrito usan botones compartidos y siguen respondiendo', () => {
  const add = jest.fn();
  const confirm = jest.fn();
  render(<><QuantityStepper quantity={1} productName="Sopa" onIncrease={add} /><CartSummaryBar total={50} onConfirm={confirm} /><CartFab /></>);
  const increase = screen.getByRole('button', { name: /aumentar cantidad/i });
  const submit = screen.getByRole('button', { name: /enviar pedido/i });
  const cart = screen.getByRole('button', { name: /carrito/i });
  for (const button of [increase, submit]) expect(button).toHaveAttribute('data-component', 'button');
  expect(cart).toHaveAttribute('data-variant', 'primary');
  fireEvent.click(increase);
  fireEvent.click(submit);
  expect(add).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(1);
});
