import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useTableSelection } from '../src/components/mesas/useTableSelection';
import { BulkActionBar } from '../src/components/mesas/BulkActionBar';
import { DeleteTablesDialog } from '../src/components/mesas/DeleteTablesDialog';
import * as tablesApi from '../src/lib/tablesApi';
import type { TableItem } from '../src/components/mesas/types';

const sampleTables: TableItem[] = [
  { tableId: 'tbl-1', label: 'Mesa 1', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
  { tableId: 'tbl-2', label: 'Mesa 2', status: 'active', createdAt: '2026-10-27T10:00:00Z' },
  { tableId: 'tbl-3', label: 'Mesa 3', status: 'inactive', createdAt: '2026-10-27T10:00:00Z' },
];

describe('U8 - Selección múltiple, BulkActionBar y DeleteTablesDialog', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('useTableSelection', () => {
    test('selecciona individualmente, selecciona todas, limpia selección y alterna todas las visibles', () => {
      const { result } = renderHook(() => useTableSelection(sampleTables));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allVisibleSelected).toBe(false);
      expect(result.current.isSelected('tbl-1')).toBe(false);

      // Seleccionar individual
      act(() => {
        result.current.toggleOne('tbl-1');
      });
      expect(result.current.isSelected('tbl-1')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selectedTables).toEqual([sampleTables[0]]);
      expect(result.current.allVisibleSelected).toBe(false);

      // Deseleccionar individual
      act(() => {
        result.current.toggleOne('tbl-1');
      });
      expect(result.current.isSelected('tbl-1')).toBe(false);
      expect(result.current.selectedCount).toBe(0);

      // Seleccionar todas las visibles (sin argumento = todas las de tables)
      act(() => {
        result.current.selectAllVisible();
      });
      expect(result.current.selectedCount).toBe(3);
      expect(result.current.allVisibleSelected).toBe(true);
      expect(result.current.selectedTables).toHaveLength(3);

      // toggleAllVisible cuando todas están seleccionadas -> limpia
      act(() => {
        result.current.toggleAllVisible();
      });
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.allVisibleSelected).toBe(false);

      // toggleAllVisible con subconjunto de IDs visibles -> selecciona ese subconjunto
      act(() => {
        result.current.toggleAllVisible(['tbl-1', 'tbl-2']);
      });
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.isSelected('tbl-1')).toBe(true);
      expect(result.current.isSelected('tbl-2')).toBe(true);
      expect(result.current.isSelected('tbl-3')).toBe(false);

      // clearSelection limpia todo
      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedCount).toBe(0);
    });

    test('poda automáticamente IDs seleccionados cuando una mesa desaparece de tables', () => {
      const { result, rerender } = renderHook(
        ({ tables }) => useTableSelection(tables),
        { initialProps: { tables: sampleTables } }
      );

      act(() => {
        result.current.selectAllVisible();
      });
      expect(result.current.selectedCount).toBe(3);

      // Simulamos refresco donde tbl-2 fue eliminada
      const remainingTables = [sampleTables[0], sampleTables[2]];
      rerender({ tables: remainingTables });

      expect(result.current.selectedCount).toBe(2);
      expect(result.current.isSelected('tbl-1')).toBe(true);
      expect(result.current.isSelected('tbl-2')).toBe(false);
      expect(result.current.isSelected('tbl-3')).toBe(true);
      expect(result.current.selectedTables).toEqual(remainingTables);
      expect(result.current.allVisibleSelected).toBe(true);
    });
  });

  describe('BulkActionBar', () => {
    const baseHandlers = () => ({
      onToggleSelectAll: jest.fn(),
      onClearSelection: jest.fn(),
      onActivateSelected: jest.fn(),
      onDeactivateSelected: jest.fn(),
      onBatchEditSelected: jest.fn(),
      onDeleteSelected: jest.fn(),
    });

    test('no renderiza nada cuando selectedCount === 0', () => {
      const handlers = baseHandlers();
      const { container } = render(
        <BulkActionBar
          selectedCount={0}
          totalCount={3}
          allSelected={false}
          {...handlers}
        />
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('region', { name: /Acciones en lote/i })).not.toBeInTheDocument();
    });

    test('es visible cuando selectedCount >= 1 y dispara callbacks de activar, desactivar, editar en lote, eliminar, seleccionar todas y limpiar', () => {
      const handlers = baseHandlers();
      render(
        <BulkActionBar
          selectedCount={2}
          totalCount={3}
          allSelected={false}
          {...handlers}
        />
      );

      const region = screen.getByRole('region', { name: /Acciones en lote/i });
      expect(region).toBeInTheDocument();
      expect(screen.getByText(/2 seleccionada\(s\)/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Seleccionar todas/i }));
      expect(handlers.onToggleSelectAll).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /^Limpiar selección$/i }));
      expect(handlers.onClearSelection).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /^Activar$/i }));
      expect(handlers.onActivateSelected).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /^Desactivar$/i }));
      expect(handlers.onDeactivateSelected).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Editar \/ Renombrar en lote/i }));
      expect(handlers.onBatchEditSelected).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Eliminar seleccionadas/i }));
      expect(handlers.onDeleteSelected).toHaveBeenCalledTimes(1);
    });
  });

  describe('DeleteTablesDialog', () => {
    test('muestra advertencia previa cuando alguna mesa seleccionada está en occupiedTableIds', () => {
      render(
        <DeleteTablesDialog
          open={true}
          tablesToDelete={[sampleTables[0], sampleTables[1]]}
          occupiedTableIds={new Set(['tbl-2'])}
          onClose={jest.fn()}
          onCompleted={jest.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Mesa 1')).toBeInTheDocument();
      expect(screen.getByText('Mesa 2')).toBeInTheDocument();
      expect(
        screen.getByText(/no podrán eliminarse hasta cerrar su sesión/i)
      ).toBeInTheDocument();
    });

    test('eliminación exitosa (failed: []) llama a deleteTablesBatch y onCompleted', async () => {
      const deleteSpy = jest.spyOn(tablesApi, 'deleteTablesBatch').mockResolvedValueOnce({
        deleted: ['tbl-1', 'tbl-3'],
        failed: [],
      });
      const onCompleted = jest.fn();
      const onClose = jest.fn();

      render(
        <DeleteTablesDialog
          open={true}
          tablesToDelete={[sampleTables[0], sampleTables[2]]}
          occupiedTableIds={new Set()}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Eliminar mesas|Confirmar eliminación/i }));

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(['tbl-1', 'tbl-3']);
      });

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledWith({
          deleted: ['tbl-1', 'tbl-3'],
          failed: [],
        });
      });
      expect(onClose).toHaveBeenCalled();
    });

    test('eliminación parcial (200 con deleted y failed TABLE_HAS_ACTIVE_SESSION) llama onCompleted y muestra el desglose con "Tiene una sesión activa"', async () => {
      const partialResult: tablesApi.DeleteTablesBatchResult = {
        deleted: ['tbl-1'],
        failed: [{ tableId: 'tbl-2', code: 'TABLE_HAS_ACTIVE_SESSION' }],
      };
      jest.spyOn(tablesApi, 'deleteTablesBatch').mockResolvedValueOnce(partialResult);
      const onCompleted = jest.fn();
      const onClose = jest.fn();

      render(
        <DeleteTablesDialog
          open={true}
          tablesToDelete={[sampleTables[0], sampleTables[1]]}
          occupiedTableIds={new Set(['tbl-2'])}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Eliminar mesas|Confirmar eliminación/i }));

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledWith(partialResult);
      });

      const alertBox = await screen.findByRole('alert');
      expect(alertBox).toBeInTheDocument();
      expect(alertBox).toHaveTextContent('Mesa 2');
      expect(alertBox).toHaveTextContent(/Tiene una sesión activa/i);
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Cerrar|Entendido/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('eliminación fallida total (409 TABLES_NOT_DELETABLE con error.details.failed) muestra el desglose en role="alert"', async () => {
      const err: any = new Error('Ninguna mesa pudo eliminarse');
      err.status = 409;
      err.code = 'TABLES_NOT_DELETABLE';
      err.details = {
        deleted: [],
        failed: [
          { tableId: 'tbl-1', code: 'TABLE_HAS_ACTIVE_SESSION' },
          { tableId: 'tbl-2', code: 'TABLE_NOT_FOUND' },
        ],
      };
      jest.spyOn(tablesApi, 'deleteTablesBatch').mockRejectedValueOnce(err);
      const onCompleted = jest.fn();
      const onClose = jest.fn();

      render(
        <DeleteTablesDialog
          open={true}
          tablesToDelete={[sampleTables[0], sampleTables[1]]}
          occupiedTableIds={new Set(['tbl-1'])}
          onClose={onClose}
          onCompleted={onCompleted}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Eliminar mesas|Confirmar eliminación/i }));

      const alertBox = await screen.findByRole('alert');
      expect(alertBox).toBeInTheDocument();
      expect(alertBox).toHaveTextContent('Mesa 1');
      expect(alertBox).toHaveTextContent(/Tiene una sesión activa/i);
      expect(alertBox).toHaveTextContent('Mesa 2');
      expect(alertBox).toHaveTextContent(/Mesa no encontrada/i);
      expect(onCompleted).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Cerrar|Entendido/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
