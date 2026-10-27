"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  FeatureGuard,
  Proximamente,
  EmptyState,
  ErrorState,
  Skeleton,
  BentoCard,
  TabsPill,
  StatusChip,
  ModalConfirm,
  Toast,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';
import { getUserRole } from '../../../lib/auth';

export interface AjustesViewProps {
  initialLoading?: boolean;
  initialError?: string | null;
  defaultTab?: string;
}

interface TeamMember {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  createdAt?: string;
}

export function AjustesView({
  initialLoading = false,
  initialError = null,
  defaultTab,
}: AjustesViewProps) {
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF' | null>(() =>
    getUserRole(ApiClient.token)
  );

  useEffect(() => {
    const currentRole = getUserRole(ApiClient.token);
    setRole(currentRole);
    if (!defaultTab) {
      setActiveTab(currentRole === 'ADMIN' ? 'equipo' : 'seguridad');
    }
  }, [defaultTab]);

  const isAdmin = role === 'ADMIN';

  // Tabs permitidos según rol: ADMIN ve Equipo y Seguridad; los demás sólo Seguridad
  const availableTabs = isAdmin
    ? [
        { id: 'equipo', label: 'Equipo' },
        { id: 'seguridad', label: 'Mi Contraseña' },
      ]
    : [{ id: 'seguridad', label: 'Mi Contraseña' }];

  const [activeTab, setActiveTab] = useState<string>(
    defaultTab || (getUserRole(ApiClient.token) === 'ADMIN' ? 'equipo' : 'seguridad')
  );

  // Estado del equipo
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(initialLoading);
  const [errorTeam, setErrorTeam] = useState<string | null>(initialError);

  useEffect(() => {
    if (!isAdmin && activeTab === 'equipo') {
      setActiveTab('seguridad');
    }
  }, [isAdmin, activeTab]);

  // Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales Equipo
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Modal Confirmar Desactivar / Reactivar
  const [confirmModalData, setConfirmModalData] = useState<{
    open: boolean;
    user?: TeamMember;
    action: 'disable' | 'enable';
  }>({ open: false, action: 'disable' });

  // Modal Cambiar Rol
  const [roleModalData, setRoleModalData] = useState<{
    open: boolean;
    user?: TeamMember;
    selectedRole: 'MANAGER' | 'STAFF';
  }>({ open: false, selectedRole: 'STAFF' });

  // Modal Restablecer Contraseña
  const [resetModalData, setResetModalData] = useState<{
    open: boolean;
    user?: TeamMember;
    customPassword: string;
  }>({ open: false, customPassword: '' });

  // Formulario Cambiar Contraseña Propia
  const [currentPassword, setCurrentPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingTeam(true);
    setErrorTeam(null);
    try {
      const res = await ApiClient.listTeam();
      setTeam(res.data || []);
    } catch (err: any) {
      setErrorTeam(err.message || 'Error al cargar la lista de miembros');
    } finally {
      setLoadingTeam(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchTeam();
    }
  }, [isAdmin, fetchTeam]);

  // Generador de contraseña aleatoria
  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pass = 'Resto!';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newEmail || !newName || !newPassword) {
      setAddError('Todos los campos son obligatorios');
      return;
    }
    if (newPassword.length < 8) {
      setAddError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSubmittingAdd(true);
    try {
      await ApiClient.createTeamMember({
        email: newEmail.trim(),
        displayName: newName.trim(),
        role: newRole,
        password: newPassword,
      });
      setToastMessage('Miembro del equipo agregado exitosamente');
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      fetchTeam();
    } catch (err: any) {
      setAddError(err.message || 'Error al crear el miembro');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleActive = async () => {
    const user = confirmModalData.user;
    if (!user) return;
    const makeActive = confirmModalData.action === 'enable';
    try {
      await ApiClient.setTeamMemberActive(user.id, makeActive);
      setToastMessage(makeActive ? 'Usuario reactivado' : 'Usuario desactivado');
      setConfirmModalData({ open: false, action: 'disable' });
      fetchTeam();
    } catch (err: any) {
      setToastMessage(err.message || 'Error al cambiar estado');
    }
  };

  const handleUpdateRole = async () => {
    const user = roleModalData.user;
    if (!user) return;
    try {
      await ApiClient.updateTeamMember(user.id, { role: roleModalData.selectedRole });
      setToastMessage('Rol actualizado exitosamente');
      setRoleModalData({ open: false, selectedRole: 'STAFF' });
      fetchTeam();
    } catch (err: any) {
      setToastMessage(err.message || 'Error al actualizar rol');
    }
  };

  const handleResetPassword = async () => {
    const user = resetModalData.user;
    if (!user) return;
    try {
      const res = await ApiClient.resetTeamMemberPassword(
        user.id,
        resetModalData.customPassword || undefined
      );
      setToastMessage(`Contraseña restablecida. Nueva: ${res.data?.password || resetModalData.customPassword}`);
      setResetModalData({ open: false, customPassword: '' });
      fetchTeam();
    } catch (err: any) {
      setToastMessage(err.message || 'Error al restablecer contraseña');
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword || !changeNewPassword) {
      setPasswordError('Ingresa la contraseña actual y la nueva');
      return;
    }
    if (changeNewPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (changeNewPassword !== confirmNewPassword) {
      setPasswordError('Las nuevas contraseñas no coinciden');
      return;
    }

    setSubmittingPassword(true);
    try {
      await ApiClient.changePassword({
        currentPassword,
        newPassword: changeNewPassword,
      });
      setToastMessage('Tu contraseña ha sido actualizada exitosamente');
      setCurrentPassword('');
      setChangeNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} duration={4000} />
        </div>
      )}

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <TabsPill
          tabs={availableTabs}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab)}
          ariaLabel="Secciones de ajustes"
        />
      )}

      {/* Pestaña: Equipo (ADMIN) */}
      {activeTab === 'equipo' && isAdmin && (
        <BentoCard
          style={{
            backgroundColor: 'var(--bento-papel)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--bento-tinta)' }}>
                Gestión de Equipo
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
                Administra los perfiles de tu restaurante (MANAGER y STAFF).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddError(null);
                setNewPassword(generatePassword());
                setShowAddModal(true);
              }}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: 'none',
                borderRadius: 'var(--bento-pill-radius)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              + Agregar miembro
            </button>
          </div>

          {loadingTeam ? (
            <Skeleton height="160px" />
          ) : errorTeam ? (
            <ErrorState
              title="Error al cargar equipo"
              message={errorTeam}
              onRetry={fetchTeam}
            />
          ) : team.length === 0 ? (
            <EmptyState
              title="Sin miembros en el equipo"
              description="Aún no has agregado colaboradores a tu restaurante."
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bento-border)' }}>
                    <th style={{ padding: '12px 8px', color: 'var(--bento-text-muted)' }}>Nombre</th>
                    <th style={{ padding: '12px 8px', color: 'var(--bento-text-muted)' }}>Email</th>
                    <th style={{ padding: '12px 8px', color: 'var(--bento-text-muted)' }}>Rol</th>
                    <th style={{ padding: '12px 8px', color: 'var(--bento-text-muted)' }}>Estado</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--bento-text-muted)' }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((member) => {
                    const isActive = member.status === 'ACTIVE';
                    const isSelfAdmin = member.role === 'ADMIN';

                    return (
                      <tr
                        key={member.id}
                        data-testid={`team-row-${member.id}`}
                        style={{ borderBottom: '1px solid var(--bento-border)' }}
                      >
                        <td style={{ padding: '14px 8px', fontWeight: 600 }}>{member.displayName}</td>
                        <td style={{ padding: '14px 8px', color: 'var(--bento-text-muted)' }}>{member.email}</td>
                        <td style={{ padding: '14px 8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bento-hueso)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <StatusChip
                            label={isActive ? 'Activo' : 'Desactivado'}
                            tone={isActive ? 'ok' : 'error'}
                          />
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                          {!isSelfAdmin && (
                            <div
                              style={{
                                display: 'inline-flex',
                                gap: '8px',
                                justifyContent: 'flex-end',
                                flexWrap: 'wrap',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setRoleModalData({
                                    open: true,
                                    user: member,
                                    selectedRole: member.role === 'MANAGER' ? 'MANAGER' : 'STAFF',
                                  })
                                }
                                style={{
                                  minHeight: '44px',
                                  padding: '0 12px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--bento-border)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Rol
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModalData({
                                    open: true,
                                    user: member,
                                    action: isActive ? 'disable' : 'enable',
                                  })
                                }
                                style={{
                                  minHeight: '44px',
                                  padding: '0 12px',
                                  backgroundColor: isActive ? 'transparent' : 'var(--bento-lima)',
                                  color: isActive ? 'var(--bento-destructive)' : 'var(--bento-tinta)',
                                  border: '1px solid var(--bento-border)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isActive ? 'Desactivar' : 'Activar'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setResetModalData({
                                    open: true,
                                    user: member,
                                    customPassword: generatePassword(),
                                  })
                                }
                                style={{
                                  minHeight: '44px',
                                  padding: '0 12px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--bento-border)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Clave
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>
      )}

      {/* Pestaña: Seguridad / Mi Contraseña (visible para todos) */}
      {activeTab === 'seguridad' && (
        <BentoCard
          style={{
            backgroundColor: 'var(--bento-papel)',
            padding: '24px',
            maxWidth: '560px',
            width: '100%',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--bento-tinta)' }}>
            Cambiar mi Contraseña
          </h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
            Actualiza tu contraseña de acceso para mantener la seguridad de tu cuenta.
          </p>

          {passwordError && (
            <div
              role="alert"
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--bento-destructive)',
                fontSize: '0.875rem',
                marginBottom: '16px',
              }}
            >
              {passwordError}
            </div>
          )}

          <form
            onSubmit={handleChangeOwnPassword}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label
                htmlFor="currentPassword"
                style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Contraseña actual
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Tu contraseña actual"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--bento-border)',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Nueva contraseña (mínimo 8 caracteres)
              </label>
              <input
                id="newPassword"
                type="password"
                value={changeNewPassword}
                onChange={(e) => setChangeNewPassword(e.target.value)}
                placeholder="Nueva contraseña segura"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--bento-border)',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--bento-border)',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submittingPassword}
              style={{
                minHeight: '44px',
                marginTop: '8px',
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: 'none',
                borderRadius: 'var(--bento-pill-radius)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: submittingPassword ? 'not-allowed' : 'pointer',
              }}
            >
              {submittingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </BentoCard>
      )}

      {/* Modal Agregar Miembro */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-papel)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Agregar nuevo miembro</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
              Crea una cuenta para un colaborador con rol MANAGER o STAFF.
            </p>

            {addError && (
              <div
                role="alert"
                style={{
                  padding: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--bento-destructive)',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ejemplo@restaurante.com"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--bento-border)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Juan Pérez"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--bento-border)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Rol
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'MANAGER' | 'STAFF')}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--bento-border)',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--bento-papel)',
                  }}
                >
                  <option value="STAFF">STAFF (Personal de servicio / cocina)</option>
                  <option value="MANAGER">MANAGER (Administración de operaciones)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Contraseña inicial</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generatePassword())}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--bento-lima)',
                      filter: 'brightness(0.6)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Generar aleatoria
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--bento-border)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      minHeight: '44px',
                      padding: '0 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--bento-border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {showNewPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    minHeight: '44px',
                    padding: '0 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--bento-border)',
                    borderRadius: 'var(--bento-pill-radius)',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    backgroundColor: 'var(--bento-tinta)',
                    color: 'var(--bento-papel)',
                    border: 'none',
                    borderRadius: 'var(--bento-pill-radius)',
                    fontWeight: 600,
                    cursor: submittingAdd ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submittingAdd ? 'Guardando...' : 'Crear miembro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ModalConfirm Desactivar / Reactivar */}
      {confirmModalData.open && confirmModalData.user && (
        <ModalConfirm
          open={confirmModalData.open}
          title={
            confirmModalData.action === 'disable'
              ? '¿Desactivar usuario?'
              : '¿Reactivar usuario?'
          }
          current={{
            label: 'Estado actual',
            value: confirmModalData.user.status,
          }}
          proposed={{
            label: 'Nuevo estado',
            value: confirmModalData.action === 'disable' ? 'DISABLED' : 'ACTIVE',
          }}
          impacts={[
            {
              label: 'Acceso',
              value:
                confirmModalData.action === 'disable'
                  ? 'El usuario no podrá iniciar sesión y sus tokens se revocarán.'
                  : 'El usuario podrá volver a ingresar al sistema de inmediato.',
            },
          ]}
          approveLabel={confirmModalData.action === 'disable' ? 'Desactivar' : 'Reactivar'}
          rejectLabel="Cancelar"
          onApprove={handleToggleActive}
          onReject={() => setConfirmModalData({ open: false, action: 'disable' })}
        />
      )}

      {/* Modal Cambiar Rol */}
      {roleModalData.open && roleModalData.user && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-papel)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Cambiar rol</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
              Modificar rol de {roleModalData.user.displayName} ({roleModalData.user.email}).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="roleSelect"
                  value="STAFF"
                  checked={roleModalData.selectedRole === 'STAFF'}
                  onChange={() => setRoleModalData({ ...roleModalData, selectedRole: 'STAFF' })}
                />
                <span>STAFF (Personal de servicio / cocina)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="roleSelect"
                  value="MANAGER"
                  checked={roleModalData.selectedRole === 'MANAGER'}
                  onChange={() => setRoleModalData({ ...roleModalData, selectedRole: 'MANAGER' })}
                />
                <span>MANAGER (Administración de operaciones)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setRoleModalData({ open: false, selectedRole: 'STAFF' })}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  border: 'none',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Guardar rol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Restablecer Contraseña */}
      {resetModalData.open && resetModalData.user && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-papel)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Restablecer contraseña</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
              Asigna una nueva contraseña temporal para {resetModalData.user.displayName}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Nueva contraseña</label>
              <input
                type="text"
                value={resetModalData.customPassword}
                onChange={(e) =>
                  setResetModalData({ ...resetModalData, customPassword: e.target.value })
                }
                style={{
                  minHeight: '44px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--bento-border)',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setResetModalData({
                    ...resetModalData,
                    customPassword: generatePassword(),
                  })
                }
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: 'none',
                  color: 'var(--bento-lima)',
                  filter: 'brightness(0.6)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginTop: '4px',
                }}
              >
                Regenerar contraseña
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setResetModalData({ open: false, customPassword: '' })}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--bento-border)',
                  borderRadius: 'var(--bento-pill-radius)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: 'var(--bento-tinta)',
                  color: 'var(--bento-papel)',
                  border: 'none',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AjustesPage() {
  return (
    <FeatureGuard
      flag="table-qr"
      fallback={<Proximamente featureName="Ajustes y Configuración" />}
    >
      <AjustesView />
    </FeatureGuard>
  );
}
