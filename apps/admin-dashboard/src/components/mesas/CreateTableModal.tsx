import React, { useEffect, useRef } from 'react';
import { FOCUSABLE_SELECTOR } from './types';

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
  const createModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    createModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!createModalRef.current) return;
        const nodes = Array.from(
          createModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === createModalRef.current)) {
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-table-title"
      ref={createModalRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (!createModalRef.current) return;
          const nodes = Array.from(
            createModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
          );
          if (nodes.length === 0) {
            e.preventDefault();
            return;
          }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === createModalRef.current)) {
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
          maxWidth: '420px',
          boxShadow: 'var(--bento-card-shadow)',
          border: '1px solid var(--bento-border)',
        }}
      >
        <h2
          id="create-table-title"
          style={{
            margin: '0 0 16px 0',
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: 'var(--bento-font-heading)',
            color: 'var(--bento-text)',
          }}
        >
          Nueva Mesa
        </h2>

        {error && (
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
                border: '1px solid var(--bento-border)',
                backgroundColor: 'var(--bento-papel)',
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
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: '1px solid var(--bento-tinta)',
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
      </div>
    </div>
  );
}
