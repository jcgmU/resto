import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FOCUSABLE_SELECTOR, TableItem } from './types';
import { TableUpdatePatch, updateTablesBatch } from '../../lib/tablesApi';

export interface BatchEditModalProps {
  open: boolean;
  tables: TableItem[];
  initialMode?: 'rename' | 'status';
  onClose: () => void;
  onSuccess: (updated: TableItem[]) => void | Promise<void>;
}

interface RowDraft {
  tableId: string;
  originalLabel: string;
  originalStatus: 'active' | 'inactive';
  label: string;
  statusChoice: 'unchanged' | 'active' | 'inactive';
}

function normalizeLabelKey(label: string): string {
  return label.trim().normalize('NFC').toLocaleLowerCase('es');
}

export function BatchEditModal({
  open,
  tables,
  initialMode = 'rename',
  onClose,
  onSuccess,
}: BatchEditModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [prefix, setPrefix] = useState('Mesa');
  const [startNumber, setStartNumber] = useState('1');
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());
  const [conflictLabelKeys, setConflictLabelKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || tables.length === 0) return;
    setRows(
      tables.map((t) => ({
        tableId: t.tableId,
        originalLabel: t.label,
        originalStatus: t.status === 'inactive' ? 'inactive' : 'active',
        label: t.label,
        statusChoice: 'unchanged',
      }))
    );
    setPrefix('Mesa');
    setStartNumber('1');
    setSaving(false);
    setServerError(null);
    setConflictIds(new Set());
    setConflictLabelKeys(new Set());
  }, [open, tables, initialMode]);

  useEffect(() => {
    if (!open || tables.length === 0) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const nodes = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === modalRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [open, tables.length, onClose]);

  const validation = useMemo(() => {
    const counts = new Map<string, number>();
    const rowErrors = new Map<string, string>();

    for (const r of rows) {
      const trimmed = r.label.trim().normalize('NFC');
      if (trimmed.length === 0) {
        rowErrors.set(r.tableId, 'El nombre no puede estar vacío');
      } else if (trimmed.length > 40) {
        rowErrors.set(r.tableId, 'Máximo 40 caracteres');
      } else {
        const key = normalizeLabelKey(trimmed);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const duplicateKeys = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) {
        duplicateKeys.add(key);
      }
    });

    for (const r of rows) {
      const key = normalizeLabelKey(r.label);
      if (key && duplicateKeys.has(key) && !rowErrors.has(r.tableId)) {
        rowErrors.set(r.tableId, 'Nombre duplicado en el lote');
      }
    }

    const isValid = rows.length > 0 && rowErrors.size === 0;
    return {
      isValid,
      rowErrors,
      duplicateKeys,
    };
  }, [rows]);

  if (!open || tables.length === 0) return null;

  const clearServerConflicts = () => {
    if (serverError) setServerError(null);
    if (conflictIds.size > 0) setConflictIds(new Set());
    if (conflictLabelKeys.size > 0) setConflictLabelKeys(new Set());
  };

  const handleApplyPattern = () => {
    clearServerConflicts();
    const cleanPrefix = prefix.trim().normalize('NFC') || 'Mesa';
    const parsedStart = Number.parseInt(startNumber, 10);
    const start = Number.isFinite(parsedStart) && parsedStart >= 0 ? parsedStart : 1;

    setRows((prev) =>
      prev.map((row, idx) => ({
        ...row,
        label: `${cleanPrefix} ${start + idx}`,
      }))
    );
  };

  const handleGlobalStatus = (targetStatus: 'active' | 'inactive' | 'unchanged') => {
    clearServerConflicts();
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        statusChoice: targetStatus,
      }))
    );
  };

  const handleRowLabelChange = (tableId: string, newLabel: string) => {
    clearServerConflicts();
    setRows((prev) =>
      prev.map((row) => (row.tableId === tableId ? { ...row, label: newLabel } : row))
    );
  };

  const handleRowStatusChange = (
    tableId: string,
    newChoice: 'unchanged' | 'active' | 'inactive'
  ) => {
    clearServerConflicts();
    setRows((prev) =>
      prev.map((row) =>
        row.tableId === tableId ? { ...row, statusChoice: newChoice } : row
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || saving) return;

    clearServerConflicts();
    setSaving(true);

    const updates: TableUpdatePatch[] = rows.map((row) => {
      const effectiveStatus =
        row.statusChoice === 'unchanged' ? row.originalStatus : row.statusChoice;
      return {
        tableId: row.tableId,
        label: row.label.trim().normalize('NFC'),
        status: effectiveStatus,
      };
    });

    try {
      const res = await updateTablesBatch(updates);
      await onSuccess(res.tables);
      onClose();
    } catch (err: any) {
      const rawConflicts = err?.details?.conflicts;
      const nextConflictIds = new Set<string>();
      const nextConflictKeys = new Set<string>();
      const conflictLabels: string[] = [];

      if (Array.isArray(rawConflicts)) {
        for (const item of rawConflicts) {
          if (typeof item === 'string') {
            conflictLabels.push(item);
            nextConflictKeys.add(normalizeLabelKey(item));
          } else if (item && typeof item === 'object') {
            if (typeof item.tableId === 'string') {
              nextConflictIds.add(item.tableId);
            }
            if (typeof item.label === 'string') {
              conflictLabels.push(item.label);
              nextConflictKeys.add(normalizeLabelKey(item.label));
            }
          }
        }
      }

      setConflictIds(nextConflictIds);
      setConflictLabelKeys(nextConflictKeys);

      if (err?.code === 'TABLE_LABEL_TAKEN' || err?.status === 409) {
        const suffix =
          conflictLabels.length > 0 ? `: ${conflictLabels.join(', ')}` : '';
        setServerError(
          `No se guardaron los cambios porque hay nombres en conflicto${suffix}.`
        );
      } else {
        setServerError(err?.message || 'Error al actualizar las mesas en lote.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-edit-modal-title"
      ref={modalRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (!modalRef.current) return;
          const nodes = Array.from(
            modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
          );
          if (nodes.length === 0) {
            e.preventDefault();
            return;
          }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === modalRef.current)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'color-mix(in srgb, var(--bento-tinta) 45%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bento-papel)',
          color: 'var(--bento-text)',
          padding: '24px',
          borderRadius: 'var(--bento-card-radius)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--bento-card-shadow)',
          border: '1px solid var(--bento-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2
            id="batch-edit-modal-title"
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
            }}
          >
            Editar {tables.length} {tables.length === 1 ? 'mesa' : 'mesas'} en lote
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--bento-text-muted)',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {serverError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bento-papel)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-inner-radius)',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Bloque de renombrado por patrón */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--bento-hueso)',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '10px',
                color: 'var(--bento-text)',
              }}
            >
              Renombrado rápido por patrón
            </div>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ flex: '1 1 160px' }}>
                <label
                  htmlFor="batch-pattern-prefix"
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Prefijo
                </label>
                <input
                  id="batch-pattern-prefix"
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ width: '120px' }}>
                <label
                  htmlFor="batch-pattern-start"
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Número inicial
                </label>
                <input
                  id="batch-pattern-start"
                  type="number"
                  min={0}
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleApplyPattern}
                style={{
                  minHeight: '38px',
                  padding: '0 14px',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  border: '1px solid var(--bento-tinta)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Aplicar patrón a seleccionadas
              </button>
            </div>
          </div>

          {/* Acción rápida global de estado */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
              }}
            >
              Estado para todas:
            </span>
            <button
              type="button"
              onClick={() => handleGlobalStatus('active')}
              style={{
                minHeight: '34px',
                padding: '0 12px',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Marcar todas como Activas
            </button>
            <button
              type="button"
              onClick={() => handleGlobalStatus('inactive')}
              style={{
                minHeight: '34px',
                padding: '0 12px',
                backgroundColor: 'var(--bento-papel)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Marcar todas como Deshabilitadas
            </button>
          </div>

          {/* Lista de filas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            {rows.map((row) => {
              const rowValidationError = validation.rowErrors.get(row.tableId);
              const isServerConflict =
                conflictIds.has(row.tableId) ||
                conflictLabelKeys.has(normalizeLabelKey(row.label));
              const hasIssue = Boolean(rowValidationError || isServerConflict);

              return (
                <div
                  key={row.tableId}
                  data-testid={`batch-edit-row-${row.tableId}`}
                  data-conflict={isServerConflict ? 'true' : 'false'}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: hasIssue
                      ? '1px solid var(--bento-destructive)'
                      : '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 200px' }}>
                      <label
                        htmlFor={`batch-row-label-${row.tableId}`}
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          color: 'var(--bento-text-muted)',
                          marginBottom: '2px',
                        }}
                      >
                        Nombre para {row.originalLabel}
                      </label>
                      <input
                        id={`batch-row-label-${row.tableId}`}
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          handleRowLabelChange(row.tableId, e.target.value)
                        }
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 'var(--bento-inner-radius)',
                          border: '1px solid var(--bento-border)',
                          backgroundColor: 'var(--bento-papel)',
                          color: 'var(--bento-text)',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ width: '170px' }}>
                      <label
                        htmlFor={`batch-row-status-${row.tableId}`}
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          color: 'var(--bento-text-muted)',
                          marginBottom: '2px',
                        }}
                      >
                        Estado ({row.originalLabel})
                      </label>
                      <select
                        id={`batch-row-status-${row.tableId}`}
                        value={row.statusChoice}
                        onChange={(e) =>
                          handleRowStatusChange(
                            row.tableId,
                            e.target.value as 'unchanged' | 'active' | 'inactive'
                          )
                        }
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 'var(--bento-inner-radius)',
                          border: '1px solid var(--bento-border)',
                          backgroundColor: 'var(--bento-papel)',
                          color: 'var(--bento-text)',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="unchanged">Sin cambio</option>
                        <option value="active">Activa</option>
                        <option value="inactive">Deshabilitada</option>
                      </select>
                    </div>
                  </div>

                  {(rowValidationError || isServerConflict) && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--bento-destructive)',
                        fontWeight: 600,
                      }}
                    >
                      {rowValidationError || 'En conflicto: este nombre ya está ocupado'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                backgroundColor: 'transparent',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!validation.isValid || saving}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: '1px solid var(--bento-tinta)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: !validation.isValid || saving ? 'not-allowed' : 'pointer',
                opacity: !validation.isValid || saving ? 0.6 : 1,
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
