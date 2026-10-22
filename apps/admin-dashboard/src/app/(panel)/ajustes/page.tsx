"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  FeatureGuard,
  Proximamente,
  EmptyState,
  ErrorState,
  Skeleton,
  BentoCard,
  StatusChip,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export interface AjustesViewProps {
  initialLoading?: boolean;
  initialError?: string | null;
}

interface Employee {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  monitorKind?: string | null;
}

export function AjustesView({ initialLoading = false, initialError = null }: AjustesViewProps) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(initialError);

  // Equipo
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'WAITER' | 'CASHIER' | 'MONITOR' | 'MANAGER' | 'ADMIN'>('WAITER');
  const [newMonitorKind, setNewMonitorKind] = useState<'kitchen' | 'bar'>('kitchen');
  const [newPassword, setNewPassword] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);

  // Facturación Electrónica (U12)
  const [invoiceMode, setInvoiceMode] = useState<'simple' | 'dian'>('simple');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const [usersRes, settingsRes] = await Promise.allSettled([
        ApiClient.request('/v1/identity/users'),
        ApiClient.request('/v1/tenant/settings'),
      ]);

      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.data)) {
        setEmployees(usersRes.value.data);
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.invoiceMode) {
        setInvoiceMode(settingsRes.value.data.invoiceMode);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar ajustes');
    } finally {
      setLoadingEmployees(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadData);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    if (!newName.trim() || !newEmail.trim()) {
      setUserFormError('Nombre y correo son obligatorios');
      return;
    }

    if ((newRole === 'WAITER' || newRole === 'CASHIER') && newPassword.length < 8) {
      setUserFormError('La contraseña debe tener al menos 8 caracteres para mesero y caja');
      return;
    }

    if (newRole === 'MONITOR' && !newPassword.trim()) {
      setUserFormError('La contraseña es requerida para el monitor');
      return;
    }

    setSubmittingUser(true);
    try {
      const payload: any = {
        displayName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        password: newPassword,
      };
      if (newRole === 'MONITOR') {
        payload.monitorKind = newMonitorKind;
      }

      await ApiClient.request('/v1/identity/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUserFormSuccess(`Empleado ${newName.trim()} creado con éxito`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowNewForm(false);
      await loadData();
    } catch (err: any) {
      setUserFormError(err?.message || 'Error al crear empleado');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleUpdateInvoiceMode = async (mode: 'simple' | 'dian') => {
    if (mode === 'dian') return; // Deshabilitado: sin proveedor aún
    setSavingInvoice(true);
    setInvoiceSuccess(false);
    try {
      await ApiClient.request('/v1/tenant/settings', {
        method: 'PATCH',
        body: JSON.stringify({ invoiceMode: mode }),
      });
      setInvoiceMode(mode);
      setInvoiceSuccess(true);
      setTimeout(() => setInvoiceSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar facturación');
    } finally {
      setSavingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '0 24px 24px' }}>
        <Skeleton height="160px" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '0 24px 24px' }}>
        <ErrorState
          title="Error en ajustes"
          message={error}
          onRetry={() => {
            setError(null);
            loadData();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sección 1: Equipo de Trabajo (U4 R2) */}
      <BentoCard
        style={{
          backgroundColor: 'var(--bento-card-bg-solid)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--bento-text-strong)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              Equipo de Trabajo
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
              Gestiona el personal del restaurante y sus perfiles de acceso (Meseros, Caja, Monitores de Cocina/Bar).
            </p>
          </div>
          <button
            type="button"
            data-testid="toggle-new-employee-button"
            onClick={() => {
              setShowNewForm(!showNewForm);
              setUserFormError(null);
              setUserFormSuccess(null);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--bento-radius-md, 8px)',
              border: '1px solid var(--bento-border)',
              backgroundColor: 'var(--bento-accent)',
              color: 'var(--bento-card-bg-solid)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--bento-font-body)',
            }}
          >
            {showNewForm ? 'Cancelar' : '+ Nuevo Empleado'}
          </button>
        </div>

        {userFormSuccess && (
          <div
            data-testid="employee-success-alert"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--bento-radius-md, 8px)',
              backgroundColor: 'var(--bento-surface)',
              border: '1px solid var(--bento-border)',
              color: 'var(--bento-text-strong)',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            {userFormSuccess}
          </div>
        )}

        {showNewForm && (
          <form
            data-testid="new-employee-form"
            onSubmit={handleCreateEmployee}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '20px',
              backgroundColor: 'var(--bento-page-bg)',
              borderRadius: 'var(--bento-radius-md, 8px)',
              border: '1px solid var(--bento-border)',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--bento-text-strong)' }}>
              Registrar Nuevo Empleado
            </h3>

            {userFormError && (
              <div
                data-testid="employee-error-alert"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--bento-radius-sm, 6px)',
                  backgroundColor: 'var(--bento-surface)',
                  border: '1px solid var(--bento-border)',
                  color: 'var(--bento-text-strong)',
                  fontSize: '0.8125rem',
                }}
              >
                {userFormError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--bento-text-strong)', marginBottom: '4px' }}>
                  Nombre Completo
                </label>
                <input
                  type="text"
                  data-testid="employee-name-input"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Carlos Mesero"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--bento-radius-sm, 6px)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text-strong)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--bento-text-strong)', marginBottom: '4px' }}>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  data-testid="employee-email-input"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ej. carlos@resto.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--bento-radius-sm, 6px)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text-strong)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: newRole === 'MONITOR' ? '1fr 1fr' : '1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--bento-text-strong)', marginBottom: '4px' }}>
                  Rol de Acceso
                </label>
                <select
                  data-testid="employee-role-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--bento-radius-sm, 6px)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text-strong)',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="WAITER">Mesero (Terminal Móvil)</option>
                  <option value="CASHIER">Caja (Terminal de Cobro)</option>
                  <option value="MONITOR">Monitor KDS (Cocina / Bar)</option>
                  <option value="MANAGER">Encargado</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              {newRole === 'MONITOR' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--bento-text-strong)', marginBottom: '4px' }}>
                    Tipo de Monitor
                  </label>
                  <select
                    data-testid="employee-monitor-kind-select"
                    value={newMonitorKind}
                    onChange={(e) => setNewMonitorKind(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--bento-radius-sm, 6px)',
                      border: '1px solid var(--bento-border)',
                      backgroundColor: 'var(--bento-card-bg-solid)',
                      color: 'var(--bento-text-strong)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="kitchen">Monitor de Cocina</option>
                    <option value="bar">Monitor de Bar</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--bento-text-strong)', marginBottom: '4px' }}>
                Contraseña
              </label>
              <input
                type="password"
                data-testid="employee-password-input"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={newRole === 'WAITER' || newRole === 'CASHIER' ? 'Mínimo 8 caracteres' : 'Contraseña de acceso'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--bento-radius-sm, 6px)',
                  border: '1px solid var(--bento-border)',
                  backgroundColor: 'var(--bento-card-bg-solid)',
                  color: 'var(--bento-text-strong)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--bento-text-muted)', marginTop: '4px' }}>
                {newRole === 'WAITER' || newRole === 'CASHIER'
                  ? 'Política: mínimo 8 caracteres (requerido para Mesero y Caja).'
                  : 'Contraseña requerida para inicio de sesión en terminal.'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--bento-radius-sm, 6px)',
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
                data-testid="create-employee-button"
                disabled={submittingUser}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--bento-radius-sm, 6px)',
                  border: '1px solid var(--bento-border)',
                  backgroundColor: 'var(--bento-accent)',
                  color: 'var(--bento-card-bg-solid)',
                  fontWeight: 600,
                  cursor: submittingUser ? 'not-allowed' : 'pointer',
                  opacity: submittingUser ? 0.7 : 1,
                }}
              >
                {submittingUser ? 'Guardando...' : 'Crear Empleado'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de Empleados */}
        {loadingEmployees ? (
          <Skeleton height="120px" />
        ) : employees.length === 0 ? (
          <EmptyState
            title="Sin empleados registrados"
            description="Crea tu primer mesero, cajero o monitor para comenzar a operar."
          />
        ) : (
          <div data-testid="employee-list" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bento-border)', color: 'var(--bento-text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Nombre</th>
                  <th style={{ padding: '8px 12px' }}>Correo</th>
                  <th style={{ padding: '8px 12px' }}>Rol</th>
                  <th style={{ padding: '8px 12px' }}>Detalle</th>
                  <th style={{ padding: '8px 12px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    data-testid={`employee-row-${emp.id}`}
                    style={{ borderBottom: '1px solid var(--bento-border)', color: 'var(--bento-text-strong)' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{emp.displayName || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bento-text-muted)' }}>{emp.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--bento-radius-sm, 4px)',
                          backgroundColor: 'var(--bento-surface)',
                          border: '1px solid var(--bento-border)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {emp.role === 'WAITER' ? 'Mesero'
                          : emp.role === 'CASHIER' ? 'Caja'
                          : emp.role === 'MONITOR' ? 'Monitor KDS'
                          : emp.role === 'MANAGER' ? 'Encargado'
                          : emp.role === 'ADMIN' ? 'Administrador'
                          : emp.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                      {emp.role === 'MONITOR' ? (emp.monitorKind === 'bar' ? 'Barra' : 'Cocina') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusChip
                        label={emp.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        tone={emp.status === 'ACTIVE' ? 'ok' : 'neutral'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

      {/* Sección 2: Facturación Electrónica (U12 R2) */}
      <BentoCard
        style={{
          backgroundColor: 'var(--bento-card-bg-solid)',
          padding: '24px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--bento-text-strong)',
              fontFamily: 'var(--bento-font-heading)',
            }}
          >
            Facturación Electrónica
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--bento-text-muted)' }}>
            Configuración del modo de emisión de comprobantes fiscales por restaurante.
          </p>
        </div>

        {invoiceSuccess && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--bento-radius-md, 8px)',
              backgroundColor: 'var(--bento-surface)',
              border: '1px solid var(--bento-border)',
              color: 'var(--bento-text-strong)',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            Modo de facturación actualizado a {invoiceMode === 'dian' ? 'DIAN via Moca' : 'simple (sin DIAN)'}.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label
            data-testid="invoice-mode-simple"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: 'var(--bento-radius-md, 8px)',
              border: `1px solid ${invoiceMode === 'simple' ? 'var(--bento-accent)' : 'var(--bento-border)'}`,
              backgroundColor: invoiceMode === 'simple' ? 'var(--bento-surface)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="invoiceMode"
              checked={invoiceMode === 'simple'}
              onChange={() => handleUpdateInvoiceMode('simple')}
              disabled={savingInvoice}
            />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--bento-text-strong)', fontSize: '0.875rem' }}>
                Simple (sin DIAN)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)', marginTop: '2px' }}>
                Comprobantes de pago internos del restaurante. No emite factura electrónica ante la autoridad tributaria.
              </div>
            </div>
          </label>

          <label
            data-testid="invoice-mode-dian"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: 'var(--bento-radius-md, 8px)',
              border: `1px solid ${invoiceMode === 'dian' ? 'var(--bento-accent)' : 'var(--bento-border)'}`,
              backgroundColor: invoiceMode === 'dian' ? 'var(--bento-surface)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="invoiceMode"
              checked={invoiceMode === 'dian'}
              onChange={() => handleUpdateInvoiceMode('dian')}
              disabled={savingInvoice}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--bento-text-strong)', fontSize: '0.875rem' }}>
                  DIAN via Moca
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--bento-pill-radius)',
                    backgroundColor: 'var(--bento-note-general-bg)',
                    border: '1px solid var(--bento-note-general-border)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--bento-status-reserved-text)',
                  }}
                >
                  Requiere credenciales configuradas
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--bento-text-muted)', marginTop: '2px' }}>
                Emite factura electrónica a través de Moca (requiere MOCA_API_URL, MOCA_ACCOUNT_ID y MOCA_API_KEY).
              </div>
            </div>
          </label>
        </div>
      </BentoCard>

      {/* Sección 3: Configuración del Sistema (conserva compatibilidad con suite) */}
      <BentoCard
        style={{
          backgroundColor: 'var(--bento-card-bg-solid)',
          padding: '24px',
        }}
      >
        <EmptyState
          title="Configuración del Sistema"
          description="Ajustes de idioma, perfil de restaurante y preferencias operativas."
        />
      </BentoCard>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <FeatureGuard
      flag="multi-language"
      fallback={<Proximamente featureName="Ajustes y Configuración" />}
    >
      <AjustesView />
    </FeatureGuard>
  );
}
