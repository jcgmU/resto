import { Modal } from '@packages/ui-components';
import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteTablesBatch,
  type DeleteBatchFailedItem,
  type DeleteTablesBatchResult,
} from '../../lib/tablesApi';
import { type TableItem } from './types';

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
  if (code === 'TABLE_HAS_RESERVATIONS') {
    return 'Tiene reservas futuras';
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

  }, [open]);

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
    <Modal open={true} title={batchResult ? 'Resultado de la eliminación' : `Eliminar ${tablesToDelete.length} mesa(s)`} onClose={() => { if (!submitting) onClose(); }} maxWidth="480px" footer={<></>}>
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
                backgroundColor: 'var(--bento-panel-bg)',
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
                  backgroundColor: 'var(--bento-card-bg-solid)',
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
                  backgroundColor: 'var(--bento-card-bg-solid)',
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
                  color: 'var(--bento-card-bg-solid)',
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
                backgroundColor: 'var(--bento-panel-bg)',
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
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: '1px solid var(--bento-border)',
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
    </Modal>
  );
}
