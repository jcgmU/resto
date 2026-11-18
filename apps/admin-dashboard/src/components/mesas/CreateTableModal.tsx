import { Modal } from '@packages/ui-components';
import React from 'react';

export interface CreateTableModalProps {
  open: boolean;
  labelValue: string;
  onChangeLabel: (val: string) => void;
  error: string | null;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateTableModal({
  open,
  labelValue,
  onChangeLabel,
  error,
  creating,
  onSubmit,
  onClose,
}: CreateTableModalProps) {

  if (!open) return null;

  return (
    <Modal open={true} title="Nueva Mesa" onClose={onClose} maxWidth="420px" footer={<></>}>
        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bento-card-bg-solid)',
              color: 'var(--bento-destructive)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-inner-radius)',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="table-label-input"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
              }}
            >
              Nombre o Identificador
            </label>
            <input
              id="table-label-input"
              type="text"
              placeholder="Ej: Mesa 1, Barra 2, Terraza B"
              value={labelValue}
              onChange={(e) => onChangeLabel(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-field-border)',
                backgroundColor: 'var(--bento-field-bg)',
                color: 'var(--bento-text)',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                fontFamily: 'var(--bento-font-body)',
              }}
              autoFocus
            />
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
              disabled={creating}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-primary)',
                color: 'var(--bento-card-bg-solid)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-pill-radius)',
                cursor: creating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              {creating ? 'Guardando...' : 'Guardar Mesa'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
