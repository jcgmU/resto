"use client";
import React, { useState } from 'react';
import { Modal } from '@packages/ui-components';
import { ApiClient } from '../lib/api';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      onClose();
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
    <Modal
      open={open}
      title="Cambiar contraseña"
      onClose={onClose}
      onSubmit={handleSubmit}
      primaryLabel="Actualizar contraseña"
      primaryLoading={submitting}
      primaryLoadingLabel="Actualizando..."
    >
      {error && (
        <div role="alert" style={{ fontSize: '0.875rem', color: 'var(--bento-danger-text)' }}>
          {error}
        </div>
      )}
      {fields.map((f) => (
        <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor={f.id}>{f.label}</label>
          <input id={f.id} type="password" value={f.value} onChange={(e) => f.set(e.target.value)} />
        </div>
      ))}
    </Modal>
  );
}
