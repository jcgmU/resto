"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setError(null);
    setIsNetworkError(false);
    setLoading(true);

    try {
      const payload: any = {
        restaurantName,
        adminEmail,
        adminPassword,
        adminDisplayName: adminDisplayName.trim() || restaurantName,
      };
      if (slug.trim()) {
        payload.slug = slug.trim();
      }
      await ApiClient.register(payload);
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/menu');
      }
      router.push('/menu');
    } catch (err: any) {
      if (
        err.code === 'NETWORK_ERROR' ||
        err.name === 'TypeError' ||
        err.message?.toLowerCase().includes('fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('conectar')
      ) {
        setError('No pudimos conectar con el servidor. Revisa que esté encendido e inténtalo de nuevo.');
        setIsNetworkError(true);
      } else if (err.status === 409 || err.code === 'CONFLICT' || err.message?.includes('registrado')) {
        setError('El restaurante o correo ya está registrado');
        setIsNetworkError(false);
      } else {
        setError(err.message || 'Error al registrar el restaurante');
        setIsNetworkError(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bento-page-bg)',
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: 'var(--bento-font-body)',
      }}
    >
      <style>{`
        input:focus-visible {
          outline: var(--bento-focus-ring);
          outline-offset: 2px;
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <BentoCard
          style={{
            backgroundColor: 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-card-radius)',
            boxShadow: 'var(--bento-card-shadow)',
            padding: '32px 28px',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '1.75rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text-strong)',
                letterSpacing: '-0.02em',
              }}
            >
              Crear Restaurante
            </h1>
            <p
              style={{
                margin: '0 0 24px 0',
                color: 'var(--bento-text-muted)',
                fontSize: '0.9375rem',
                fontFamily: 'var(--bento-font-body)',
                lineHeight: 1.4,
              }}
            >
              Registra tu negocio para empezar a gestionar cartas y pedidos
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  marginBottom: '20px',
                  borderRadius: 'var(--bento-inner-radius)',
                  backgroundColor: 'var(--bento-note-item-bg, #fbeaea)',
                  border: '1px solid var(--bento-status-occupied)',
                  color: 'var(--bento-status-occupied-text)',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
                {isNetworkError && (
                  <button
                    type="button"
                    onClick={() => handleRegister()}
                    disabled={loading}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--bento-status-occupied)',
                      borderRadius: 'var(--bento-pill-radius)',
                      color: 'var(--bento-status-occupied-text)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--bento-font-body)',
                    }}
                  >
                    Reintentar
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="restaurantName"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Nombre del Restaurante
                </label>
                <input
                  id="restaurantName"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Mi Restaurante Gourmet"
                  required
                  disabled={loading}
                  style={{
                    minHeight: 'var(--bento-touch-target, 44px)',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text)',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--bento-font-body)',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="adminEmail"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Correo Electrónico (Admin)
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@resto.com"
                  required
                  disabled={loading}
                  style={{
                    minHeight: 'var(--bento-touch-target, 44px)',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text)',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--bento-font-body)',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="adminPassword"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Contraseña (Admin)
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{
                    minHeight: 'var(--bento-touch-target, 44px)',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text)',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--bento-font-body)',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="slug"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Slug URL (opcional)
                </label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="mi-restaurante"
                  disabled={loading}
                  style={{
                    minHeight: 'var(--bento-touch-target, 44px)',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-card-bg-solid)',
                    color: 'var(--bento-text)',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--bento-font-body)',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                style={{
                  marginTop: '8px',
                  minHeight: 'var(--bento-touch-target, 44px)',
                  padding: '12px 20px',
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: '1px solid var(--bento-primary)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-body)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              >
                {loading && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                )}
                <span>{loading ? 'Creando cuenta...' : 'Crear Cuenta y Restaurante'}</span>
              </button>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: '12px',
                  fontSize: '0.8125rem',
                  color: 'var(--bento-text-muted)',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                ¿Ya tienes una cuenta?{' '}
                <a
                  href="/login"
                  style={{
                    color: 'var(--bento-primary)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Inicia sesión aquí
                </a>
              </div>
            </form>
          </div>
        </BentoCard>
      </div>
    </main>
  );
}
