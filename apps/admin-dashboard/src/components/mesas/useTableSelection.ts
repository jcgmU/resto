import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TableItem } from './types';

export interface UseTableSelectionResult {
  selectedIds: Set<string>;
  isSelected: (tableId: string) => boolean;
  toggleOne: (tableId: string) => void;
  selectAllVisible: (visibleTableIds?: string[]) => void;
  clearSelection: () => void;
  toggleAllVisible: (visibleTableIds?: string[]) => void;
  selectedCount: number;
  allVisibleSelected: boolean;
  selectedTables: TableItem[];
}

export function useTableSelection(tables: TableItem[]): UseTableSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const validIds = new Set(tables.map((t) => t.tableId));
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tables]);

  const isSelected = useCallback(
    (tableId: string) => selectedIds.has(tableId),
    [selectedIds]
  );

  const toggleOne = useCallback((tableId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(
    (visibleTableIds?: string[]) => {
      const ids = visibleTableIds ?? tables.map((t) => t.tableId);
      setSelectedIds(new Set(ids));
    },
    [tables]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const toggleAllVisible = useCallback(
    (visibleTableIds?: string[]) => {
      const ids = visibleTableIds ?? tables.map((t) => t.tableId);
      setSelectedIds((prev) => {
        const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
        if (allSelected) {
          if (visibleTableIds) {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          }
          return new Set();
        }
        return new Set(ids);
      });
    },
    [tables]
  );

  const selectedTables = useMemo(
    () => tables.filter((t) => selectedIds.has(t.tableId)),
    [tables, selectedIds]
  );

  const selectedCount = selectedTables.length;
  const allVisibleSelected =
    tables.length > 0 && tables.every((t) => selectedIds.has(t.tableId));

  return {
    selectedIds,
    isSelected,
    toggleOne,
    selectAllVisible,
    clearSelection,
    toggleAllVisible,
    selectedCount,
    allVisibleSelected,
    selectedTables,
  };
}
