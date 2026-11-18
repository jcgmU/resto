import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../src/kit/Modal';

test('Escape cierra únicamente el diálogo superior', () => {
  function Stack() {
    const [lower, setLower] = useState(true);
    const [upper, setUpper] = useState(true);
    return <>
      <Modal open={lower} title="Inferior" onClose={() => setLower(false)} />
      <Modal open={upper} title="Superior" onClose={() => setUpper(false)} />
    </>;
  }
  render(<Stack />);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Superior' })).toBeNull();
  const lower = screen.getByRole('dialog', { name: 'Inferior' });
  expect(lower.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
