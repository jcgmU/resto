"use client";
import React, { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../lib/api';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--bento-inner-radius)',
  border: '1px solid var(--bento-field-border)',
  backgroundColor: 'var(--bento-field-bg)',
  color: 'var(--bento-text-strong)',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--bento-text-strong)',
};

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword) {
      setError('Ingresa la contraseña actual y la nueva');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las nuevas contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      await ApiClient.changePassword({ currentPassword, newPassword });
      onCloseRef.current();
    } catch (err: any) {
      setError(err?.message || 'Error al cambiar la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    { id: 'terminal-current-password', label: 'Contraseña actual', value: currentPassword, set: setCurrentPassword },
    { id: 'terminal-new-password', label: 'Nueva contraseña (mínimo 8 caracteres)', value: newPassword, set: setNewPassword },
    { id: 'terminal-confirm-password', label: 'Confirmar nueva contraseña', value: confirmPassword, set: setConfirmPassword },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bento-overlay-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        style={{
          backgroundColor: 'var(--bento-card-bg-solid)',
          borderRadius: 'var(--bento-card-radius)',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="change-password-title" style={{ margin: '0 0 16px', fontSize: '1.125rem', color: 'var(--bento-text-strong)' }}>
          Cambiar contraseña
        </h2>
        {error && (
          <div role="alert" style={{ marginBottom: '12px', fontSize: '0.875rem', color: 'var(--bento-danger-text)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {fields.map((f) => (
            <div key={f.id}>
              <label htmlFor={f.id} style={labelStyle}>
                {f.label}
              </label>
              <input
                id={f.id}
                type="password"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                style={fieldStyle}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--bento-inner-radius)',
                border: '1px solid var(--bento-border)',
                backgroundColor: 'transparent',
                color: 'var(--bento-text-strong)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--bento-inner-radius)',
                border: 'none',
                backgroundColor: 'var(--bento-primary)',
                color: 'var(--bento-card-bg-solid)',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
