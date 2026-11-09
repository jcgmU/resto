import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteTablesBatch,
  type DeleteBatchFailedItem,
  type DeleteTablesBatchResult,
} from '../../lib/tablesApi';
import { FOCUSABLE_SELECTOR, type TableItem } from './types';

export interface DeleteTablesDialogProps {
  open: boolean;
  tablesToDelete: TableItem[];
  occupiedTableIds: Set<string>;
  onClose: () => void;
  onCompleted: (result: DeleteTablesBatchResult) => void | Promise<void>;
}

function getFailureReasonLabel(code: DeleteBatchFailedItem['code'] | string): string {
  if (code === 'TABLE_HAS_ACTIVE_SESSION') {
    return 'Tiene una sesión activa';
  }
  if (code === 'TABLE_NOT_FOUND') {
    return 'Mesa no encontrada';
  }
  return 'No se pudo eliminar';
}

export function DeleteTablesDialog({
  open,
  tablesToDelete,
  occupiedTableIds,
  onClose,
  onCompleted,
}: DeleteTablesDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<DeleteTablesBatchResult | null>(null);
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setBatchResult(null);
      setUnexpectedError(null);
      return;
    }

    const prevFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!submitting) {
          onClose();
        }
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
  }, [open, submitting, onClose]);

  const labelByTableId = useMemo(() => {
    const map = new Map<string, string>();
    tablesToDelete.forEach((t) => {
      map.set(t.tableId, t.label || t.tableId);
    });
    return map;
  }, [tablesToDelete]);

  const occupiedTables = useMemo(
    () => tablesToDelete.filter((t) => occupiedTableIds.has(t.tableId)),
    [tablesToDelete, occupiedTableIds]
  );

  if (!open || tablesToDelete.length === 0) {
    return null;
  }

  const handleConfirmDelete = async () => {
    if (submitting) return;
    setSubmitting(true);
    setUnexpectedError(null);

    try {
      const tableIds = tablesToDelete.map((t) => t.tableId);
      const result = await deleteTablesBatch(tableIds);
      if (result.failed.length === 0 && result.deleted.length > 0) {
        await onCompleted(result);
        onClose();
        return;
      }

      if (result.deleted.length > 0) {
        await onCompleted(result);
      }
      setBatchResult(result);
    } catch (err: any) {
      const details = err?.details;
      const isNotDeletable =
        err?.code === 'TABLES_NOT_DELETABLE' ||
        (details && Array.isArray(details.failed));

      if (isNotDeletable) {
        const deleted: string[] = Array.isArray(details?.deleted) ? details.deleted : [];
        const failed: DeleteBatchFailedItem[] = Array.isArray(details?.failed)
          ? details.failed
          : [];
        const normalizedResult: DeleteTablesBatchResult = { deleted, failed };
        if (deleted.length > 0) {
          await onCompleted(normalizedResult);
        }
        setBatchResult(normalizedResult);
      } else {
        setUnexpectedError(err?.message || 'Error al eliminar mesas');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-tables-dialog-title"
      ref={modalRef}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
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
          maxWidth: '480px',
          border: '1px solid var(--bento-border)',
        }}
      >
        <h2
          id="delete-tables-dialog-title"
          style={{
            margin: '0 0 12px 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--bento-text)',
          }}
        >
          {batchResult
            ? 'Resultado de la eliminación'
            : `Eliminar ${tablesToDelete.length} mesa(s)`}
        </h2>

        {!batchResult ? (
          <>
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '0.9rem',
                color: 'var(--bento-text-muted)',
              }}
            >
              Confirma la eliminación de las siguientes mesas seleccionadas:
            </p>

            <ul
              style={{
                margin: '0 0 16px 0',
                padding: '10px 14px',
                listStyle: 'none',
                maxHeight: '180px',
                overflowY: 'auto',
                backgroundColor: 'var(--bento-hueso)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-inner-radius)',
              }}
            >
              {tablesToDelete.map((table) => {
                const isOccupied = occupiedTableIds.has(table.tableId);
                return (
                  <li
                    key={table.tableId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      fontSize: '0.9rem',
                      color: 'var(--bento-text)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{table.label}</span>
                    {isOccupied && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--bento-destructive)',
                        }}
                      >
                        Sesión activa
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {occupiedTables.length > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  border: '1px solid var(--bento-destructive)',
                  borderRadius: 'var(--bento-inner-radius)',
                  fontSize: '0.85rem',
                }}
              >
                {`Aviso: ${occupiedTables.length} mesa(s) seleccionada(s) tienen una sesión activa y no podrán eliminarse hasta cerrar su sesión.`}
              </div>
            )}

            {unexpectedError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  border: '1px solid var(--bento-destructive)',
                  borderRadius: 'var(--bento-inner-radius)',
                  fontSize: '0.85rem',
                }}
              >
                {unexpectedError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                style={{
                  minHeight: '42px',
                  padding: '0 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--bento-text)',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                style={{
                  minHeight: '42px',
                  padding: '0 18px',
                  backgroundColor: 'var(--bento-destructive)',
                  color: 'var(--bento-papel)',
                  border: '1px solid var(--bento-destructive)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Eliminando...' : 'Eliminar mesas'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                marginBottom: '16px',
                backgroundColor: 'var(--bento-hueso)',
                color: 'var(--bento-text)',
                border: '1px solid var(--bento-destructive)',
                borderRadius: 'var(--bento-inner-radius)',
                fontSize: '0.9rem',
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
                Eliminadas: {batchResult.deleted.length} · No eliminadas:{' '}
                {batchResult.failed.length}
              </p>

              {batchResult.failed.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {batchResult.failed.map((item) => {
                    const label = labelByTableId.get(item.tableId) || item.tableId;
                    const reason = getFailureReasonLabel(item.code);
                    return (
                      <li
                        key={item.tableId}
                        style={{
                          marginBottom: '4px',
                          color: 'var(--bento-destructive)',
                        }}
                      >
                        <strong>{label}</strong>: {reason}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  minHeight: '42px',
                  padding: '0 18px',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  border: '1px solid var(--bento-tinta)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Entendido
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
