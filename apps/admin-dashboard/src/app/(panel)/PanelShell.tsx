"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarRail, PageHeader, ErrorState, BentoCard } from '@packages/ui-components';
import type { SidebarRailItem } from '@packages/ui-components';
import { ApiClient } from '../../lib/api';
import { getUserRole, isRouteAllowedForRole } from '../../lib/auth';

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
    label: 'Dashboard',
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
    id: 'menu',
    label: 'Menu',
    href: '/menu',
    icon: (
      <Svg>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </Svg>
    ),
  },
  {
    id: 'mesas',
    label: 'Mesas',
    href: '/mesas',
    icon: (
      <Svg>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </Svg>
    ),
  },
  {
    id: 'kds',
    label: 'KDS',
    href: '/kds',
    icon: (
      <Svg>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
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
    id: 'pagos',
    label: 'Pagos',
    href: '/pagos',
    icon: (
      <Svg>
        <path d="M4 7h16v10H4zM4 11h16" />
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
  return NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.id;
}

export default function PanelShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = ApiClient.token;
    if (!token) {
      setIsAuthenticated(false);
      // Fallback for tests or non-Next environments
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/login');
      }
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return null;
  }

  const role = getUserRole(ApiClient.token);
  const visibleNav = NAV.filter((n) => {
    if (role === 'STAFF') {
      return n.id === 'kds' || n.id === 'mesas' || n.id === 'checkout';
    }
    return true;
  });

  const activeId = activeIdFor(pathname);
  const items: SidebarRailItem[] = visibleNav.map((n) => ({
    id: n.id,
    label: n.label,
    href: n.href,
    icon: n.icon,
  }));
  const title = NAV.find((n) => n.id === activeId)?.label ?? 'Panel';

  const isAllowed = isRouteAllowedForRole(pathname || '', role);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bento-hueso)' }}>
      <SidebarRail items={items} activeId={activeId} />
      <div style={{ flex: 1, minWidth: 0 }}>
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
          }}
        >
          {isAllowed ? (
            children
          ) : (
            <BentoCard
              style={{
                backgroundColor: 'var(--bento-papel)',
                padding: '32px',
                textAlign: 'center',
              }}
            >
              <ErrorState
                title="Sin permiso"
                message="No tienes los permisos requeridos para acceder a esta sección."
              />
            </BentoCard>
          )}
        </main>
      </div>
    </div>
  );
}
