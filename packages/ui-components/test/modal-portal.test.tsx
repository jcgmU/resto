import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal } from '../src/kit/Modal';

test('el fondo del modal se monta directamente en el viewport fuera de sus ancestros', () => {
  const { container } = render(
    <div style={{ backdropFilter: 'blur(4px)' }}>
      <Modal open title="Editar mesa" onClose={() => {}} />
    </div>,
  );
  const backdrop = screen.getByTestId('modal-backdrop');
  expect(backdrop.parentElement).toBe(document.body);
  expect(container.contains(backdrop)).toBe(false);
  expect(screen.getByRole('dialog', { name: 'Editar mesa' })).toBeTruthy();
});
