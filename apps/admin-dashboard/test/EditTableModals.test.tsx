import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EditTableModal } from '../src/components/mesas/EditTableModal';
import { BatchEditModal } from '../src/components/mesas/BatchEditModal';
import * as tablesApi from '../src/lib/tablesApi';
import type { TableItem } from '../src/components/mesas/types';

jest.mock('../src/lib/tablesApi', () => ({
  ...jest.requireActual('../src/lib/tablesApi'),
  updateTable: jest.fn(),
  updateTablesBatch: jest.fn(),
}));

const mockedUpdateTable = tablesApi.updateTable as jest.MockedFunction<typeof tablesApi.updateTable>;
const mockedUpdateTablesBatch = tablesApi.updateTablesBatch as jest.MockedFunction<
  typeof tablesApi.updateTablesBatch
>;

const baseTable: TableItem = {
  tableId: 'tbl-1',
  label: 'Mesa 1',
  status: 'active',
  createdAt: '2026-10-27T10:00:00Z',
};

const batchTables: TableItem[] = [
  {
    tableId: 'tbl-1',
    label: 'Mesa 1',
    status: 'active',
    createdAt: '2026-10-27T10:00:00Z',
  },
  {
    tableId: 'tbl-2',
    label: 'Mesa 2',
    status: 'active',
    createdAt: '2026-10-27T10:01:00Z',
  },
];

describe('U7: EditTableModal y BatchEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EditTableModal', () => {
    test('no renderiza nada cuando table es null', () => {
      const { container } = render(
        <EditTableModal table={null} onClose={jest.fn()} onSuccess={jest.fn()} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    test('renderiza diálogo accesible con label y estado actual y cierra con Escape o Cancelar sin llamar a la API', () => {
      const onClose = jest.fn();
      render(
        <EditTableModal table={baseTable} onClose={onClose} onSuccess={jest.fn()} />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const labelInput = screen.getByLabelText(/Nombre de la mesa/i) as HTMLInputElement;
      expect(labelInput.value).toBe('Mesa 1');

      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockedUpdateTable).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(mockedUpdateTable).not.toHaveBeenCalled();
    });

    test('valida label vacío o mayor a 40 caracteres antes de enviar', async () => {
      const onSuccess = jest.fn();
      render(
        <EditTableModal table={baseTable} onClose={jest.fn()} onSuccess={onSuccess} />
      );

      const labelInput = screen.getByLabelText(/Nombre de la mesa/i);
      const submitBtn = screen.getByRole('button', { name: /Guardar/i });

      fireEvent.change(labelInput, { target: { value: '   ' } });
      fireEvent.click(submitBtn);

      expect(mockedUpdateTable).not.toHaveBeenCalled();
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fireEvent.change(labelInput, { target: { value: 'A'.repeat(41) } });
      fireEvent.click(submitBtn);
      expect(mockedUpdateTable).not.toHaveBeenCalled();
    });

    test('edita label y status enviando PATCH /v1/tables/:id e invoca onSuccess y onClose', async () => {
      const updatedTable: TableItem = {
        ...baseTable,
        label: 'Mesa VIP',
        status: 'inactive',
      };
      mockedUpdateTable.mockResolvedValueOnce(updatedTable);

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <EditTableModal table={baseTable} onClose={onClose} onSuccess={onSuccess} />
      );

      const labelInput = screen.getByLabelText(/Nombre de la mesa/i);
      fireEvent.change(labelInput, { target: { value: '  Mesa VIP  ' } });

      const inactiveOption = screen.getByRole('button', { name: /Deshabilitada \(Inactiva\)/i });
      fireEvent.click(inactiveOption);

      const submitBtn = screen.getByRole('button', { name: /Guardar/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockedUpdateTable).toHaveBeenCalledWith('tbl-1', {
          label: 'Mesa VIP',
          status: 'inactive',
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(updatedTable);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    test('muestra error 409 TABLE_LABEL_TAKEN con conflictos en role="alert" sin cerrar el modal', async () => {
      const conflictError: any = new Error('El nombre de la mesa ya está en uso');
      conflictError.status = 409;
      conflictError.code = 'TABLE_LABEL_TAKEN';
      conflictError.details = { conflicts: ['Mesa 2'] };
      mockedUpdateTable.mockRejectedValueOnce(conflictError);

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <EditTableModal table={baseTable} onClose={onClose} onSuccess={onSuccess} />
      );

      const labelInput = screen.getByLabelText(/Nombre de la mesa/i);
      fireEvent.change(labelInput, { target: { value: 'Mesa 2' } });

      fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Mesa 2/i);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('BatchEditModal', () => {
    test('no renderiza nada cuando open es false o tables está vacío', () => {
      const { container, rerender } = render(
        <BatchEditModal
          open={false}
          tables={batchTables}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();

      rerender(
        <BatchEditModal
          open={true}
          tables={[]}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    test('permite swap A <-> B entre dos mesas seleccionadas y envía updateTablesBatch', async () => {
      const updatedTables: TableItem[] = [
        { ...batchTables[0], label: 'Mesa 2' },
        { ...batchTables[1], label: 'Mesa 1' },
      ];
      mockedUpdateTablesBatch.mockResolvedValueOnce({ tables: updatedTables });

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <BatchEditModal
          open={true}
          tables={batchTables}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      const input1 = screen.getByLabelText(/Nombre para Mesa 1/i);
      const input2 = screen.getByLabelText(/Nombre para Mesa 2/i);

      // En el paso intermedio ambas se llaman "Mesa 2" (duplicado en lote bloquea envío)
      fireEvent.change(input1, { target: { value: 'Mesa 2' } });
      const submitBtn = screen.getByRole('button', { name: /Guardar cambios/i });
      expect(submitBtn).toBeDisabled();

      // Al completar el swap (Mesa 1 -> Mesa 2, Mesa 2 -> Mesa 1), es válido
      fireEvent.change(input2, { target: { value: 'Mesa 1' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockedUpdateTablesBatch).toHaveBeenCalledWith([
          { tableId: 'tbl-1', label: 'Mesa 2', status: 'active' },
          { tableId: 'tbl-2', label: 'Mesa 1', status: 'active' },
        ]);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(updatedTables);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    test('aplica renombrado por patrón (Prefijo + Número inicial) y cambio de estado global a las seleccionadas', async () => {
      const updatedTables: TableItem[] = [
        { ...batchTables[0], label: 'Terraza 10', status: 'inactive' },
        { ...batchTables[1], label: 'Terraza 11', status: 'inactive' },
      ];
      mockedUpdateTablesBatch.mockResolvedValueOnce({ tables: updatedTables });

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <BatchEditModal
          open={true}
          tables={batchTables}
          initialMode="rename"
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      const prefixInput = screen.getByLabelText(/Prefijo/i);
      const startInput = screen.getByLabelText(/Número inicial/i);

      fireEvent.change(prefixInput, { target: { value: 'Terraza' } });
      fireEvent.change(startInput, { target: { value: '10' } });

      fireEvent.click(screen.getByRole('button', { name: /Aplicar patrón a seleccionadas/i }));

      const input1 = screen.getByLabelText(/Nombre para Mesa 1/i) as HTMLInputElement;
      const input2 = screen.getByLabelText(/Nombre para Mesa 2/i) as HTMLInputElement;
      expect(input1.value).toBe('Terraza 10');
      expect(input2.value).toBe('Terraza 11');

      // Acción rápida global para cambiar estado a 'inactive'
      const globalInactiveBtn = screen.getByRole('button', {
        name: /Marcar todas como Deshabilitadas/i,
      });
      fireEvent.click(globalInactiveBtn);

      fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

      await waitFor(() => {
        expect(mockedUpdateTablesBatch).toHaveBeenCalledWith([
          { tableId: 'tbl-1', label: 'Terraza 10', status: 'inactive' },
          { tableId: 'tbl-2', label: 'Terraza 11', status: 'inactive' },
        ]);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(updatedTables);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    test('maneja 409 TABLE_LABEL_TAKEN mostrando role="alert", resaltando filas en conflicto y sin refresco parcial', async () => {
      const conflictErr: any = new Error('Conflicto de nombres');
      conflictErr.status = 409;
      conflictErr.code = 'TABLE_LABEL_TAKEN';
      conflictErr.details = {
        conflicts: [{ tableId: 'tbl-2', label: 'Barra 1' }],
      };
      mockedUpdateTablesBatch.mockRejectedValueOnce(conflictErr);

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <BatchEditModal
          open={true}
          tables={batchTables}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      const input2 = screen.getByLabelText(/Nombre para Mesa 2/i);
      fireEvent.change(input2, { target: { value: 'Barra 1' } });

      fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Barra 1/i);

      const row2 = screen.getByTestId('batch-edit-row-tbl-2');
      expect(row2).toHaveAttribute('data-conflict', 'true');
      expect( within(row2).getByText(/En conflicto/i) ).toBeInTheDocument();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    test('accesibilidad: cierra con Escape y no usa tokens warning ni amber', () => {
      const onClose = jest.fn();
      render(
        <BatchEditModal
          open={true}
          tables={batchTables}
          onClose={onClose}
          onSuccess={jest.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      const fs = require('fs');
      const path = require('path');
      const editSource = fs.readFileSync(
        path.resolve(__dirname, '../src/components/mesas/EditTableModal.tsx'),
        'utf-8'
      );
      const batchSource = fs.readFileSync(
        path.resolve(__dirname, '../src/components/mesas/BatchEditModal.tsx'),
        'utf-8'
      );

      expect(editSource).not.toContain('var(--bento-warning)');
      expect(editSource).not.toContain('var(--bento-amber)');
      expect(batchSource).not.toContain('var(--bento-warning)');
      expect(batchSource).not.toContain('var(--bento-amber)');
    });
  });
});
