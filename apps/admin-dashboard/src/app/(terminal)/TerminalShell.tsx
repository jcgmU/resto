"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ApiClient } from '../../lib/api';

interface TerminalUser {
  id?: string;
  email?: string;
  displayName?: string;
  role?: string;
  monitorKind?: 'kitchen' | 'bar';
}

function getTerminalTitle(pathname: string, user: TerminalUser | null): string {
  if (pathname.includes('/monitor')) {
    return user?.monitorKind === 'bar' ? 'Monitor de Bar' : 'Monitor de Cocina';
  }
  if (pathname.includes('/terminal-mesero')) {
    return 'Terminal de Mesero';
  }
  if (pathname.includes('/terminal-caja')) {
    return 'Terminal de Caja';
  }
  return 'Terminal';
}

function getRoleLabel(role?: string, monitorKind?: string): string {
  const r = (role || '').toUpperCase();
  if (r === 'WAITER') return 'Mesero';
  if (r === 'CASHIER') return 'Cajero';
  if (r === 'MONITOR') return monitorKind === 'bar' ? 'Bar' : 'Cocina';
  if (r === 'ADMIN') return 'Administrador';
  if (r === 'MANAGER') return 'Gerente';
  return role || 'Personal';
}

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<TerminalUser | null>(null);

  useEffect(() => {
    const token = ApiClient.token;
    if (!token) {
      setIsAuthenticated(false);
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/login');
      }
      router.replace('/login');
      return;
    }

    try {
      const rawUser = typeof window !== 'undefined' ? localStorage.getItem('resto_user') : null;
      if (rawUser) {
        setCurrentUser(JSON.parse(rawUser));
      }
    } catch {
      // ignore
    }

    setIsAuthenticated(true);
  }, [router]);

  if (!isAuthenticated) {
    return null;
  }

  const title = getTerminalTitle(pathname, currentUser);
  const roleLabel = getRoleLabel(currentUser?.role, currentUser?.monitorKind);
  const canGoToPanel = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  const handleLogout = () => {
    ApiClient.token = null;
    ApiClient.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('resto_user');
      localStorage.removeItem('resto_access_token');
      localStorage.removeItem('resto_refresh_token');
    }
    router.replace('/login');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bento-page-bg)',
        color: 'var(--bento-text)',
        fontFamily: 'var(--bento-font-body)',
        boxSizing: 'border-box',
      }}
    >
      {/* Barra superior de terminal */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--bento-border)',
          boxShadow: 'var(--bento-card-shadow)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--bento-pill-radius)',
              backgroundColor: 'var(--bento-primary)',
              color: 'var(--bento-card-bg-solid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            R
          </div>
          <div>
            <h1
              data-testid="terminal-header-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text-strong)',
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {canGoToPanel && (
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid var(--bento-border)',
                borderRadius: 'var(--bento-inner-radius)',
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--bento-text)',
                cursor: 'pointer',
              }}
            >
              ← Ir al Panel
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--bento-text-strong)',
              }}
            >
              {currentUser?.displayName || 'Usuario'}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'rgba(0, 0, 0, 0.06)',
                color: 'var(--bento-text-muted)',
              }}
            >
              {roleLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            data-testid="terminal-logout-btn"
            style={{
              background: 'none',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              borderRadius: 'var(--bento-inner-radius)',
              color: 'var(--bento-status-occupied)',
              padding: '0.375rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
