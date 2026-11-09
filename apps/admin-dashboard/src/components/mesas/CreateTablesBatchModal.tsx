import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TabsPill } from '@packages/ui-components';
import { createTablesBatch } from '../../lib/tablesApi';
import { FOCUSABLE_SELECTOR, type TableItem } from './types';

export interface CreateTablesBatchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (createdTables: TableItem[]) => void | Promise<void>;
  existingTables?: TableItem[];
}

type BatchMode = 'prefix' | 'custom';

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

function normalizeLabelKey(raw: string): string {
  return raw.trim().normalize('NFC').toLocaleLowerCase('es');
}

export function CreateTablesBatchModal({
  open,
  onClose,
  onSuccess,
  existingTables = [],
}: CreateTablesBatchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [mode, setMode] = useState<BatchMode>('prefix');
  const [prefix, setPrefix] = useState<string>('Mesa');
  const [countRaw, setCountRaw] = useState<string>('5');
  const [startRaw, setStartRaw] = useState<string>('1');
  const [customText, setCustomText] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverConflictKeys, setServerConflictKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setMode('prefix');
      setPrefix('Mesa');
      setCountRaw('5');
      setStartRaw('1');
      setCustomText('');
      setCreating(false);
      setServerError(null);
      setServerConflictKeys(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
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
  }, [open]);

  const existingKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (const t of existingTables) {
      if (t.status === 'deleted') continue;
      if (typeof t.label === 'string' && t.label.trim()) {
        keys.add(normalizeLabelKey(t.label));
      }
    }
    return keys;
  }, [existingTables]);

  const analysis = useMemo(() => {
    const trimmedPrefix = prefix.trim().normalize('NFC');
    const parsedCount = Number(countRaw);
    const parsedStart = startRaw.trim() === '' ? NaN : Number(startRaw);

    let labels: string[] = [];
    let validationError: string | null = null;

    if (mode === 'prefix') {
      if (!trimmedPrefix) {
        validationError = 'El prefijo es obligatorio.';
      } else if (
        !Number.isInteger(parsedCount) ||
        parsedCount < 1 ||
        parsedCount > 50
      ) {
        validationError = 'La cantidad debe ser un número entero entre 1 y 50.';
      } else if (!Number.isInteger(parsedStart) || parsedStart < 0) {
        validationError = 'El número inicial debe ser un entero mayor o igual a 0.';
      } else {
        labels = Array.from(
          { length: parsedCount },
          (_, i) => `${trimmedPrefix} ${parsedStart + i}`
        );
      }
    } else {
      labels = customText
        .split(/\r?\n/)
        .map((line) => line.trim().normalize('NFC'))
        .filter((line) => line.length > 0);

      if (labels.length === 0) {
        validationError = 'Ingresa al menos 1 etiqueta (máximo 50).';
      } else if (labels.length > 50) {
        validationError = 'Solo puedes crear hasta 50 mesas por lote.';
      }
    }

    const seenKeys = new Map<string, number>();
    const duplicateKeys = new Set<string>();
    const existingConflicts: string[] = [];
    const conflictKeySet = new Set<string>();
    let invalidLabelError: string | null = null;

    for (const lbl of labels) {
      if (lbl.length < 1 || lbl.length > 40) {
        invalidLabelError =
          'Cada nombre de mesa debe tener entre 1 y 40 caracteres.';
      } else if (CONTROL_CHARS_RE.test(lbl)) {
        invalidLabelError =
          'Los nombres de mesa no pueden contener caracteres de control.';
      }

      const key = normalizeLabelKey(lbl);
      const prevCount = seenKeys.get(key) ?? 0;
      seenKeys.set(key, prevCount + 1);
      if (prevCount >= 1) {
        duplicateKeys.add(key);
        conflictKeySet.add(key);
      }
      if (existingKeySet.has(key)) {
        if (!conflictKeySet.has(key)) {
          existingConflicts.push(lbl);
        }
        conflictKeySet.add(key);
      }
    }

    if (!validationError && invalidLabelError) {
      validationError = invalidLabelError;
    } else if (!validationError && duplicateKeys.size > 0) {
      validationError =
        'Hay nombres duplicados en la lista. Cada mesa debe tener un nombre único.';
    } else if (!validationError && existingConflicts.length > 0) {
      validationError = `Ya existen mesas con estas etiquetas: ${existingConflicts.join(', ')}`;
    }

    const isValid =
      !validationError &&
      labels.length >= 1 &&
      labels.length <= 50 &&
      conflictKeySet.size === 0;

    return {
      labels,
      trimmedPrefix,
      parsedCount,
      parsedStart,
      validationError,
      conflictKeySet,
      isValid,
    };
  }, [mode, prefix, countRaw, startRaw, customText, existingKeySet]);

  if (!open) return null;

  const clearServerStatus = () => {
    if (serverError) setServerError(null);
    if (serverConflictKeys.size > 0) setServerConflictKeys(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysis.isValid || creating) return;

    setCreating(true);
    setServerError(null);
    setServerConflictKeys(new Set());

    try {
      const payload =
        mode === 'prefix'
          ? {
              prefix: analysis.trimmedPrefix,
              count: analysis.parsedCount,
              start: analysis.parsedStart,
            }
          : {
              labels: analysis.labels,
            };

      const res = await createTablesBatch(payload);
      await onSuccess(res.tables);
      onClose();
    } catch (err: any) {
      const code = err?.code;
      if (code === 'TABLE_LABEL_TAKEN') {
        const rawConflicts: string[] = Array.isArray(err?.details?.conflicts)
          ? err.details.conflicts
          : [];
        const keys = new Set<string>(rawConflicts.map((c) => normalizeLabelKey(String(c))));
        setServerConflictKeys(keys);
        const listStr =
          rawConflicts.length > 0 ? `: ${rawConflicts.join(', ')}` : '.';
        setServerError(
          `No se pudieron crear las mesas porque ya existen etiquetas en conflicto${listStr}`
        );
      } else if (code === 'TABLE_LIMIT_EXCEEDED') {
        setServerError(
          'Se alcanzó el límite máximo de 500 mesas activas por restaurante.'
        );
      } else {
        setServerError(err?.message || 'Error al crear mesas en lote');
      }
    } finally {
      setCreating(false);
    }
  };

  const showClientValidationAlert =
    Boolean(analysis.validationError) &&
    (mode === 'prefix' || customText.trim().length > 0);
  const activeAlert =
    serverError ?? (showClientValidationAlert ? analysis.validationError : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-tables-batch-title"
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
          maxWidth: '520px',
          border: '1px solid var(--bento-border)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2
          id="create-tables-batch-title"
          style={{
            margin: '0 0 16px 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--bento-text)',
          }}
        >
          Crear varias mesas
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <TabsPill
            ariaLabel="Modo de creación en lote"
            value={mode}
            onChange={(id) => {
              setMode(id as BatchMode);
              clearServerStatus();
            }}
            tabs={[
              { id: 'prefix', label: 'Por prefijo y cantidad' },
              { id: 'custom', label: 'Lista personalizada' },
            ]}
          />
        </div>

        {activeAlert && (
          <div
            role="alert"
            aria-live="assertive"
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
            {activeAlert}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'prefix' ? (
            <div
              id="tabpanel-prefix"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="batch-prefix-input"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Prefijo
                </label>
                <input
                  id="batch-prefix-input"
                  type="text"
                  value={prefix}
                  onChange={(e) => {
                    setPrefix(e.target.value);
                    clearServerStatus();
                  }}
                  placeholder="Ej: Mesa, Terraza, Barra"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="batch-count-input"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Cantidad (1-50)
                </label>
                <input
                  id="batch-count-input"
                  type="number"
                  min={1}
                  max={50}
                  value={countRaw}
                  onChange={(e) => {
                    setCountRaw(e.target.value);
                    clearServerStatus();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="batch-start-input"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Número inicial
                </label>
                <input
                  id="batch-start-input"
                  type="number"
                  min={0}
                  value={startRaw}
                  onChange={(e) => {
                    setStartRaw(e.target.value);
                    clearServerStatus();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              id="tabpanel-custom"
              style={{ marginBottom: '16px' }}
            >
              <label
                htmlFor="batch-custom-textarea"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--bento-text)',
                }}
              >
                Lista de nombres (una por línea)
              </label>
              <textarea
                id="batch-custom-textarea"
                rows={5}
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  clearServerStatus();
                }}
                placeholder={'Mesa VIP 1\nMesa VIP 2\nTerraza Norte'}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border: '1px solid var(--bento-border)',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-text)',
                  fontSize: '0.95rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          <div
            data-testid="batch-preview"
            style={{
              padding: '12px',
              backgroundColor: 'var(--bento-hueso)',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--bento-text-muted)',
                marginBottom: '8px',
              }}
            >
              {`Vista previa (${analysis.labels.length} mesas)`}
            </div>
            {analysis.labels.length === 0 ? (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--bento-text-muted)',
                }}
              >
                Sin mesas para previsualizar.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {analysis.labels.map((lbl, idx) => {
                  const key = normalizeLabelKey(lbl);
                  const isConflict =
                    analysis.conflictKeySet.has(key) ||
                    serverConflictKeys.has(key);
                  return (
                    <span
                      key={`${lbl}-${idx}`}
                      data-conflict={isConflict ? 'true' : undefined}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 'var(--bento-pill-radius)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bento-papel)',
                        color: isConflict
                          ? 'var(--bento-destructive)'
                          : 'var(--bento-text)',
                        border: isConflict
                          ? '1px solid var(--bento-destructive)'
                          : '1px solid var(--bento-border)',
                      }}
                    >
                      {lbl}
                    </span>
                  );
                })}
              </div>
            )}
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
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!analysis.isValid || creating}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: '1px solid var(--bento-tinta)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: !analysis.isValid || creating ? 'not-allowed' : 'pointer',
                opacity: !analysis.isValid || creating ? 0.6 : 1,
                fontWeight: 600,
              }}
            >
              {creating ? 'Creando...' : 'Crear mesas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
