"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PwaApiClient } from '../../../../lib/api';
import { BentoCard, Skeleton } from '@packages/ui-components';

export interface TableLandingPageProps {
  params: {
    tenantId: string;
    tableId: string;
  };
  searchParams?: {
    k?: string;
  };
}

export default function TableLandingPage({ params, searchParams }: TableLandingPageProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      try {
        const qrKey = searchParams?.k;
        if (!qrKey) {
          throw new Error('QR_KEY_INVALID: Código QR requerido');
        }

        await PwaApiClient.openSession({
          tenantId: params.tenantId,
          tableId: params.tableId,
          qrKey,
        });

        if (isMounted) {
          const targetUrl = `/t/${params.tenantId}/${params.tableId}/menu`;
          router.push(targetUrl);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error al conectar con la mesa');
        }
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [params.tenantId, params.tableId, searchParams?.k, router]);

  if (error) {
    return (
      <main
        style={{
          padding: '16px',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bento-page-bg-pwa)',
          fontFamily: 'var(--bento-font-body)',
        } as React.CSSProperties}
      >
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <BentoCard
            style={{
              backgroundColor: 'var(--bento-card-bg-solid)',
              '--bento-card-bg': 'var(--bento-card-bg-solid)',
              border: '1px solid var(--bento-destructive)',
              borderRadius: 'var(--bento-card-radius)',
              padding: '24px',
              textAlign: 'center',
            } as React.CSSProperties}
          >
            <div
              role="alert"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bento-page-bg-pwa)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--bento-destructive)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              <div>
                <h2
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '18px',
                    fontFamily: 'var(--bento-font-heading)',
                    fontWeight: 700,
                    color: 'var(--bento-destructive)',
                  }}
                >
                  No se pudo abrir la mesa
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: 1.4,
                    color: 'var(--bento-text)',
                    fontWeight: 500,
                  }}
                >
                  {error}
                </p>
              </div>

              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: 'var(--bento-text-muted)',
                }}
              >
                Verifica el código QR de tu mesa o consulta con el personal de sala.
              </p>
            </div>
          </BentoCard>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: '16px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bento-page-bg-pwa)',
        fontFamily: 'var(--bento-font-body)',
      } as React.CSSProperties}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <BentoCard
          style={{
            backgroundColor: 'var(--bento-card-bg-solid)',
            '--bento-card-bg': 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-card-radius)',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          } as React.CSSProperties}
        >
          {/* Skeleton animado para indicar carga de conexión */}
          <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton width="48px" height="48px" radius="50%" />
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontFamily: 'var(--bento-font-heading)',
                fontWeight: 700,
                color: 'var(--bento-text-strong)',
              }}
            >
              Conectando con tu mesa...
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--bento-text-muted)',
              }}
            >
              Abriendo sesión para mesa {params.tableId}
            </p>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <Skeleton width="100%" height="12px" radius="var(--bento-pill-radius)" />
            <Skeleton width="75%" height="12px" radius="var(--bento-pill-radius)" style={{ margin: '0 auto' }} />
          </div>
        </BentoCard>
      </div>
    </main>
  );
}
