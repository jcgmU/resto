"use client";

import React from 'react';
import { BentoCard } from '@packages/ui-components';

export default function ClientRootPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bento-page-bg-pwa)',
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: 'var(--bento-font-body)',
        color: 'var(--bento-text)',
      } as React.CSSProperties}
    >
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <header style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--bento-text-muted)',
              marginBottom: '6px',
            }}
          >
            Resto · Experiencia Digital
          </span>
        </header>

        <BentoCard
          style={{
            background: 'var(--bento-card-bg-solid)',
            border: '1px solid var(--bento-border)',
            borderRadius: 'var(--bento-card-radius)',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          {/* Ilustración SVG minimalista QR & Mesa */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: 'var(--bento-inner-radius)',
              background: 'var(--bento-page-bg-pwa)',
              border: '1px solid var(--bento-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              aria-hidden="true"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--bento-text-strong)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="3" height="3" />
              <path d="M17 17h4v4h-4z" />
              <path d="M7 7h.01" />
              <path d="M17 7h.01" />
              <path d="M7 17h.01" />
            </svg>
          </div>

          <div>
            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '26px',
                lineHeight: 1.25,
                fontFamily: 'var(--bento-font-heading)',
                fontWeight: 700,
                color: 'var(--bento-text-strong)',
              }}
            >
              Menú Digital
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: 1.5,
                color: 'var(--bento-text-muted)',
                fontFamily: 'var(--bento-font-body)',
              }}
            >
              Escanea el código QR de tu mesa con la cámara de tu teléfono para abrir la carta, ordenar y solicitar la cuenta.
            </p>
          </div>

          {/* Chip de estado / beneficio */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--bento-pill-radius)',
              background: 'var(--bento-status-available)',
              color: 'var(--bento-status-available-strong)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Sin descargas ni registros previos</span>
          </div>

          <div
            style={{
              width: '100%',
              borderTop: '1px solid var(--bento-border)',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 'var(--bento-inner-radius)',
                background: 'var(--bento-page-bg-pwa)',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                1
              </span>
              <span style={{ fontSize: '13px', color: 'var(--bento-text)' }}>
                Abre la cámara de tu móvil
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 'var(--bento-inner-radius)',
                background: 'var(--bento-page-bg-pwa)',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--bento-primary)',
                  color: 'var(--bento-card-bg-solid)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                2
              </span>
              <span style={{ fontSize: '13px', color: 'var(--bento-text)' }}>
                Enfoca el código QR de tu mesa
              </span>
            </div>
          </div>
        </BentoCard>

        <footer style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--bento-text-muted)' }}>
            Resto · Software gastronómico de alta precisión
          </p>
        </footer>
      </div>
    </main>
  );
}
