import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fetchZones, updateZone } from '../src/lib/api/tables';

jest.mock('../src/lib/api/tables', () => ({ fetchZones: jest.fn(), updateZone: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

const zoneA = { id: 'zona-a', name: 'Salón', sortOrder: 0, polygon: [[1, 1], [3, 1], [3, 3], [1, 3]] };
const zoneB = { id: 'zona-b', name: 'Terraza', sortOrder: 1, polygon: [[5, 1], [7, 1], [7, 3], [5, 3]] };
const zoneC = { id: 'zona-c', name: 'Bar', sortOrder: 2 };

beforeEach(() => {
  jest.resetAllMocks();
  (fetchZones as jest.Mock).mockResolvedValue([zoneA, zoneB, zoneC]);
  (updateZone as jest.Mock).mockImplementation(async (id, input) => ({ id, ...input }));
});

function editor() {
  const Page = require('../src/app/(panel)/mesas/espacios/page').default;
  return render(<Page />);
}

test('crea un rectángulo para una zona sin espacio y guarda el polígono', async () => {
  editor();
  fireEvent.click(await screen.findByRole('button', { name: /bar/i }));
  fireEvent.click(screen.getByRole('button', { name: /crear espacio/i }));
  expect(screen.getAllByTestId('space-vertex')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
  await waitFor(() => expect(updateZone).toHaveBeenCalledWith('zona-c', expect.objectContaining({ polygon: expect.any(Array) })));
  expect((updateZone as jest.Mock).mock.calls[0][1].polygon).toHaveLength(4);
});

test('mueve vértices con teclado, añade uno en una arista y permite quitarlo', async () => {
  editor();
  fireEvent.click(await screen.findByRole('button', { name: /salón/i }));
  let vertices = screen.getAllByTestId('space-vertex');
  fireEvent.keyDown(vertices[0], { key: 'ArrowRight' });
  expect(vertices[0]).toHaveAttribute('data-x', '1.1');
  fireEvent.doubleClick(screen.getAllByTestId('space-edge')[0]);
  vertices = screen.getAllByTestId('space-vertex');
  expect(vertices).toHaveLength(5);
  fireEvent.keyDown(vertices[1], { key: 'Delete' });
  expect(screen.getAllByTestId('space-vertex')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
  await waitFor(() => expect(updateZone).toHaveBeenCalledWith('zona-a', expect.objectContaining({ polygon: expect.any(Array) })));
});

test('bloquea solapamiento y muestra un error 422 del servidor', async () => {
  editor();
  fireEvent.click(await screen.findByRole('button', { name: /salón/i }));
  const vertex = screen.getAllByTestId('space-vertex')[1];
  for (let i = 0; i < 21; i += 1) fireEvent.keyDown(vertex, { key: 'ArrowRight' });
  expect(screen.getByRole('alert')).toHaveTextContent(/solap|superpon/i);
  expect(screen.getByRole('button', { name: /^guardar$/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /descartar/i }));
  fireEvent.keyDown(screen.getAllByTestId('space-vertex')[0], { key: 'ArrowRight' });
  (updateZone as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Fuera de límites'), { status: 422, code: 'SPACE_OUT_OF_BOUNDS' }));
  fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/límite/i);
});
