import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CreateTablesBatchModal } from '../src/components/mesas/CreateTablesBatchModal';
import * as tablesApi from '../src/lib/tablesApi';
import type { TableItem } from '../src/components/mesas/types';

jest.mock('../src/lib/tablesApi', () => ({
  ...jest.requireActual('../src/lib/tablesApi'),
  createTablesBatch: jest.fn(),
}));

const mockedCreateTablesBatch = tablesApi.createTablesBatch as jest.MockedFunction<
  typeof tablesApi.createTablesBatch
>;

describe('CreateTablesBatchModal (U6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. No renderiza nada cuando open es false y soporta accesibilidad (role="dialog", Escape cierra)', () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    const { rerender } = render(
      <CreateTablesBatchModal open={false} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<CreateTablesBatchModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('2. Modo prefijo: vista previa en vivo por defecto (Mesa 1..Mesa 5) y actualizada para { prefix: "Terraza", count: 3, start: 10 }', () => {
    render(
      <CreateTablesBatchModal open={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    const preview = screen.getByTestId('batch-preview');
    expect(preview).toHaveTextContent('Vista previa (5 mesas)');
    expect(within(preview).getByText('Mesa 1')).toBeInTheDocument();
    expect(within(preview).getByText('Mesa 5')).toBeInTheDocument();

    const prefixInput = screen.getByLabelText(/Prefijo/i);
    const countInput = screen.getByLabelText(/Cantidad/i);
    const startInput = screen.getByLabelText(/Número inicial/i);

    fireEvent.change(prefixInput, { target: { value: 'Terraza' } });
    fireEvent.change(countInput, { target: { value: '3' } });
    fireEvent.change(startInput, { target: { value: '10' } });

    expect(preview).toHaveTextContent('Vista previa (3 mesas)');
    expect(within(preview).getByText('Terraza 10')).toBeInTheDocument();
    expect(within(preview).getByText('Terraza 11')).toBeInTheDocument();
    expect(within(preview).getByText('Terraza 12')).toBeInTheDocument();
    expect(within(preview).queryByText('Mesa 1')).not.toBeInTheDocument();
  });

  test('3. Validación cliente en modo prefijo: deshabilita submit cuando cantidad es 0 o 51, o colisiona con existingTables', () => {
    const existingTables: TableItem[] = [
      { tableId: 'tbl-1', label: 'Mesa 2', status: 'active', createdAt: '2026-10-27T00:00:00Z' },
    ];

    render(
      <CreateTablesBatchModal
        open={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        existingTables={existingTables}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Crear mesas|Guardar/i });
    // Con existingTables teniendo "Mesa 2", el rango por defecto Mesa 1..5 tiene conflicto en vivo
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Mesa 2/i);

    // Cambiamos inicio a 10 para evitar colisión
    const startInput = screen.getByLabelText(/Número inicial/i);
    fireEvent.change(startInput, { target: { value: '10' } });
    expect(submitBtn).not.toBeDisabled();

    // Cantidad = 0 -> deshabilitado
    const countInput = screen.getByLabelText(/Cantidad/i);
    fireEvent.change(countInput, { target: { value: '0' } });
    expect(submitBtn).toBeDisabled();

    // Cantidad = 51 -> deshabilitado
    fireEvent.change(countInput, { target: { value: '51' } });
    expect(submitBtn).toBeDisabled();
  });

  test('4. Modo lista personalizada: procesa líneas, detecta duplicados en vivo y valida límites (0 y 51)', () => {
    render(
      <CreateTablesBatchModal open={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    const customTab = screen.getByRole('tab', { name: /Lista personalizada/i });
    fireEvent.click(customTab);

    const textarea = screen.getByLabelText(/Lista de nombres/i);
    const submitBtn = screen.getByRole('button', { name: /Crear mesas|Guardar/i });

    // Vacío (0 etiquetas) -> botón deshabilitado
    fireEvent.change(textarea, { target: { value: '   \n  ' } });
    expect(submitBtn).toBeDisabled();

    // Duplicados internos (insensible a mayúsculas y espacios)
    fireEvent.change(textarea, { target: { value: 'Barra 1\n  barra 1 \nBarra 2' } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/duplicad/i);

    // 51 etiquetas -> deshabilitado
    const fiftyOneLines = Array.from({ length: 51 }, (_, i) => `VIP ${i + 1}`).join('\n');
    fireEvent.change(textarea, { target: { value: fiftyOneLines } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/50/);

    // Etiqueta de más de 40 caracteres -> deshabilitado
    fireEvent.change(textarea, { target: { value: 'A'.repeat(41) } });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/40/);

    // Lista válida
    fireEvent.change(textarea, { target: { value: 'VIP 1\nVIP 2\nVIP 3' } });
    expect(submitBtn).not.toBeDisabled();
    const preview = screen.getByTestId('batch-preview');
    expect(preview).toHaveTextContent('Vista previa (3 mesas)');
    expect(within(preview).getByText('VIP 1')).toBeInTheDocument();
    expect(within(preview).getByText('VIP 3')).toBeInTheDocument();
  });

  test('5. Envío exitoso en modo prefijo y modo personalizado llama a createTablesBatch con payload correcto y dispara onSuccess', async () => {
    const createdPrefix: TableItem[] = [
      { tableId: 't-10', label: 'Terraza 10', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
      { tableId: 't-11', label: 'Terraza 11', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
    ];
    mockedCreateTablesBatch.mockResolvedValueOnce({ tables: createdPrefix });

    const onClose = jest.fn();
    const onSuccess = jest.fn();

    const { rerender } = render(
      <CreateTablesBatchModal open={true} onClose={onClose} onSuccess={onSuccess} />
    );

    fireEvent.change(screen.getByLabelText(/Prefijo/i), { target: { value: '  Terraza ' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Número inicial/i), { target: { value: '10' } });

    const submitBtn = screen.getByRole('button', { name: /Crear mesas|Guardar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedCreateTablesBatch).toHaveBeenCalledWith({
        prefix: 'Terraza',
        count: 2,
        start: 10,
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(createdPrefix);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Ahora probar envío en modo lista personalizada
    const createdCustom: TableItem[] = [
      { tableId: 't-20', label: 'Salón A', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
      { tableId: 't-21', label: 'Salón B', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
    ];
    mockedCreateTablesBatch.mockResolvedValueOnce({ tables: createdCustom });

    rerender(<CreateTablesBatchModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('tab', { name: /Lista personalizada/i }));
    fireEvent.change(screen.getByLabelText(/Lista de nombres/i), {
      target: { value: '  Salón A \n\n Salón B  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear mesas|Guardar/i }));

    await waitFor(() => {
      expect(mockedCreateTablesBatch).toHaveBeenLastCalledWith({
        labels: ['Salón A', 'Salón B'],
      });
    });
    expect(onSuccess).toHaveBeenLastCalledWith(createdCustom);
  });

  test('6. Manejo de error 409 TABLE_LABEL_TAKEN resalta details.conflicts en role="alert" y en la vista previa conservando el formulario', async () => {
    const conflictError = Object.assign(new Error('Labels duplicados'), {
      status: 409,
      code: 'TABLE_LABEL_TAKEN',
      details: { conflicts: ['Mesa 2', 'Mesa 4'] },
    });
    mockedCreateTablesBatch.mockRejectedValueOnce(conflictError);

    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <CreateTablesBatchModal open={true} onClose={onClose} onSuccess={onSuccess} />
    );

    const submitBtn = screen.getByRole('button', { name: /Crear mesas|Guardar/i });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Mesa 2');
    expect(alert).toHaveTextContent('Mesa 4');

    const preview = screen.getByTestId('batch-preview');
    const chip2 = within(preview).getByText('Mesa 2');
    const chip4 = within(preview).getByText('Mesa 4');
    expect(chip2).toHaveAttribute('data-conflict', 'true');
    expect(chip4).toHaveAttribute('data-conflict', 'true');

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('7. Manejo de error TABLE_LIMIT_EXCEEDED muestra alerta de límite de 500 mesas', async () => {
    const limitError = Object.assign(new Error('Limit exceeded'), {
      status: 409,
      code: 'TABLE_LIMIT_EXCEEDED',
    });
    mockedCreateTablesBatch.mockRejectedValueOnce(limitError);

    render(
      <CreateTablesBatchModal open={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Crear mesas|Guardar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/500/);
  });
});
