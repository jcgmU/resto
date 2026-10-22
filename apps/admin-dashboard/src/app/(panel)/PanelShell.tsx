"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarRail, PageHeader } from '@packages/ui-components';
import type { SidebarRailItem } from '@packages/ui-components';
import { ApiClient } from '../../lib/api';

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

interface NavDef {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV: NavDef[] = [
  {
    id: 'dashboard',
    label: 'Resumen y Mesas',
    href: '/dashboard',
    icon: (
      <Svg>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </Svg>
    ),
  },
  {
    id: 'kds',
    label: 'Monitor de Cocina',
    href: '/kds',
    icon: (
      <Svg>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </Svg>
    ),
  },
  {
    id: 'meseros',
    label: 'Terminal de Meseros',
    href: '/meseros',
    icon: (
      <Svg>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Svg>
    ),
  },
  {
    id: 'menu',
    label: 'Gestión del Menú',
    href: '/menu',
    icon: (
      <Svg>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </Svg>
    ),
  },
  {
    id: 'checkout',
    label: 'Checkout',
    href: '/checkout',
    icon: (
      <Svg>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </Svg>
    ),
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    href: '/ajustes',
    icon: (
      <Svg>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </Svg>
    ),
  },
];

function activeIdFor(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  if (pathname === '/mesas' || pathname.startsWith('/mesas/')) return 'dashboard';
  if (pathname === '/pagos' || pathname.startsWith('/pagos/')) return 'checkout';
  return NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.id;
}

function titleFor(pathname: string | null | undefined, activeId: string | undefined): string {
  if (pathname === '/checkout') return 'Checkout';
  if (pathname === '/kds') return 'Monitor de Cocina';
  if (pathname === '/menu') return 'Gestión del Menú';
  if (pathname === '/dashboard') return 'Resumen y Mesas';
  if (pathname === '/mesas') return 'Resumen y Mesas';
  if (pathname === '/meseros') return 'Terminal de Meseros';
  if (pathname === '/ajustes') return 'Ajustes';
  if (pathname === '/pagos') return 'Pagos';
  return NAV.find((n) => n.id === activeId)?.label ?? 'Panel';
}

export default function PanelShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    email?: string;
    displayName?: string;
    role?: string;
    monitorKind?: string;
  } | null>(null);

  useEffect(() => {
    const token = ApiClient.token;
    if (!token) {
      setIsAuthenticated(false);
      // Fallback for tests or non-Next environments
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/login');
      }
      router.replace('/login');
      return;
    }

    try {
      const rawUser = typeof window !== 'undefined' ? localStorage.getItem('resto_user') : null;
      if (rawUser) {
        const u = JSON.parse(rawUser);
        setCurrentUser(u);
        const role = String(u.role || '').toUpperCase();
        if (role === 'WAITER') {
          router.replace('/terminal-mesero');
          return;
        }
        if (role === 'CASHIER') {
          router.replace('/terminal-caja');
          return;
        }
        if (role === 'MONITOR') {
          router.replace('/monitor');
          return;
        }
      }
    } catch {
      // ignore json parse error
    }

    setIsAuthenticated(true);
  }, [router]);

  if (!isAuthenticated) {
    return null;
  }

  const activeId = activeIdFor(pathname);
  const items: SidebarRailItem[] = NAV.map((n) => ({
    id: n.id,
    label: n.label,
    href: n.href,
    icon: n.icon,
  }));
  const title = titleFor(pathname, activeId);

  return (
    <div
      className="panel-shell-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bento-page-bg)',
        color: 'var(--bento-text)',
        fontFamily: 'var(--bento-font-body)',
        padding: '1.5rem',
        gap: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .panel-shell-root {
            padding: 0.75rem !important;
            gap: 0.75rem !important;
          }
          .panel-inner-sidebar {
            display: none !important;
          }
        }
      `}</style>
      {/* 1. Rail lateral flotante oscuro */}
      <SidebarRail
        items={items}
        activeId={activeId}
        ariaLabel="Navegación principal"
        header={
          <div
            style={{
              marginBottom: '1rem',
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: 'var(--bento-pill-radius)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            <Svg>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </Svg>
          </div>
        }
      />

      {/* 2. Contenedor principal glass con sombras neumorfas y radio 2rem */}
      <div
        data-component="panel-main-container"
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: 'rgba(224, 227, 229, 0.5)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-border)',
          boxShadow: 'var(--bento-card-shadow)',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 'calc(100vh - 3rem)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {/* Panel interior lateral (w-[280px]) con 3 puntos pastel y nombres visibles */}
        <div
          data-component="panel-inner-sidebar"
          className="panel-inner-sidebar"
          style={{
            width: '280px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRight: '1px solid rgba(255, 255, 255, 0.4)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Tres puntos pastel de ventana */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }} data-testid="pastel-dots">
            <div
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'var(--bento-status-occupied)',
                boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.6)',
              }}
            />
            <div
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'var(--bento-status-reserved)',
                boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.6)',
              }}
            />
            <div
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'var(--bento-status-available)',
                boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.6)',
              }}
            />
          </div>

          {/* Perfil de usuario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--bento-text)',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            >
              {(currentUser?.displayName || 'Admin').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--bento-text)' }}>
                {currentUser?.displayName || 'Admin'}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--bento-text-muted)' }}>
                Restaurante • {currentUser?.role ? (currentUser.role === 'ADMIN' ? 'Administrador' : currentUser.role) : 'Panel'}
              </p>
            </div>
          </div>

          {/* Título de navegación Módulos */}
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--bento-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 0.75rem 0.5rem',
            }}
          >
            Módulos
          </p>

          {/* Navegación con nombres de sección visibles (N19) */}
          <nav
            data-component="panel-nav"
            aria-label="Módulos del panel"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 }}
          >
            {NAV.map((item) => {
              const active = item.id === activeId;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  data-active={active ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--bento-inner-radius)',
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    backgroundColor: active ? 'rgba(255, 255, 255, 0.65)' : 'transparent',
                    color: active ? 'var(--bento-text)' : 'var(--bento-text-muted)',
                    fontWeight: active ? 600 : 400,
                    boxShadow: active ? 'inset 1px 1px 2px rgba(255, 255, 255, 0.8)' : 'none',
                  }}
                >
                  <span
                    style={{
                      color: active ? 'var(--bento-primary)' : 'var(--bento-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      width: '1.25rem',
                      height: '1.25rem',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Modo de operación en el pie del panel interior */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.4)',
            }}
          >
            <p style={{ margin: '0 0 0.5rem 0.25rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--bento-text-muted)' }}>
              Modo de Operación
            </p>
            <div
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: 'var(--bento-inner-radius)',
                fontSize: '0.75rem',
                fontWeight: 500,
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                color: 'var(--bento-text)',
                boxSizing: 'border-box',
              }}
            >
              Híbrido (QR + Meseros)
            </div>
          </div>
        </div>

        {/* Contenedor de contenido */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 'var(--bento-grid-gap)' }}>
            <PageHeader greeting={title} />
          </div>
          <main
            style={{
              maxWidth: pathname === '/kds' ? '100%' : '1200px',
              margin: '0 auto',
              width: '100%',
              padding: '24px',
              boxSizing: 'border-box',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
