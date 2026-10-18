"use client";
import React, { useState } from 'react';
import {
  FeatureGuard,
  Proximamente,
  EmptyState,
  ErrorState,
  Skeleton,
  BentoCard,
} from '@packages/ui-components';

export interface AjustesViewProps {
  initialLoading?: boolean;
  initialError?: string | null;
}

export function AjustesView({ initialLoading = false, initialError = null }: AjustesViewProps) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(initialError);

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
            setLoading(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
