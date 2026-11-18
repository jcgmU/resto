"use client";
import React, { useEffect, useState } from 'react';
import { PwaApiClient } from '../lib/api';
import { BentoCard } from '@packages/ui-components';

export interface GuestSessionGuardProps {
  children: React.ReactNode;
}

export function GuestSessionGuard({ children }: GuestSessionGuardProps) {
  const [mounted, setMounted] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(PwaApiClient.guestToken));
    setMounted(true);

    const unsubscribe = PwaApiClient.subscribeAuth((valid) => {
      setHasToken((prev) => (prev !== valid ? valid : prev));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Pre-mount / SSR: renderizar placeholder neutro con tokens Lima & Tinta para evitar mismatch de hidratacion
  if (!mounted) {
    return (
      <div
        data-testid="guest-guard-loading"
        suppressHydrationWarning
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bento-page-bg-pwa)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        } as React.CSSProperties}
      />
    );
  }

  if (!hasToken) {
    return (
      <div
        data-testid="guest-guard-unauthorized"
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bento-page-bg-pwa)',
        } as React.CSSProperties}
      >
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <BentoCard style={{ backgroundColor: 'var(--bento-card-bg-solid)' } as React.CSSProperties}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  margin: '0 0 8px 0',
                  color: 'var(--bento-text-strong)',
                  fontFamily: 'var(--bento-font-heading)',
                } as React.CSSProperties}
              >
                Escanea el QR de tu mesa
              </h2>
              <p
                style={{
                  margin: 0,
                  color: 'var(--bento-text-muted)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--bento-font-body)',
                }}
              >
                Para poder ver la carta y pedir, escanea el código QR que se encuentra en tu mesa.
              </p>
            </div>
          </BentoCard>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
