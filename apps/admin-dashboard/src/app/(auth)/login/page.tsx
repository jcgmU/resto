"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = { email, password };
      if (tenantSlug.trim()) {
        payload.tenantSlug = tenantSlug.trim();
      }
      await ApiClient.login(payload);
      // Fallback for tests or non-Next environments
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/menu');
      }
      router.push('/menu');
    } catch (err: any) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setError('Credenciales inválidas. Verifica tu usuario y contraseña.');
      } else {
        setError(err.message || 'Error al iniciar sesión');
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
              Iniciar Sesión
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
              Accede al panel de administración de tu restaurante
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
                  gap: '8px',
                }}
              >
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
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="email"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Usuario o Correo
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin o ejemplo@resto.com"
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
                  htmlFor="password"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  htmlFor="tenantSlug"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Identificador de Restaurante (opcional)
                </label>
                <input
                  id="tenantSlug"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
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
                  padding: '12px 20px',
                  backgroundColor: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  border: '1px solid var(--bento-primary)',
                  borderRadius: 'var(--bento-pill-radius)',
                  fontSize: '0.95rem',
                  minHeight: 'var(--bento-touch-target, 44px)',
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
                <span>{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
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
                ¿No tienes cuenta?{' '}
                <a
                  href="/register"
                  style={{
                    color: 'var(--bento-primary)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Regístrate aquí
                </a>
              </div>
            </form>
          </div>
        </BentoCard>
      </div>
    </main>
  );
}
