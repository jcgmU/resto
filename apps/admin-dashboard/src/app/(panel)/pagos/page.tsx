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

export interface PagosViewProps {
  initialLoading?: boolean;
  initialError?: string | null;
}

export function PagosView({ initialLoading = false, initialError = null }: PagosViewProps) {
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
          title="Error en pagos"
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
          title="Sin historial de pagos"
          description="Actualmente los cobros se realizan en efectivo (CASH) directamente desde la mesa o checkout. El historial de transacciones estará disponible próximamente."
        />
      </BentoCard>
    </div>
  );
}

export default function PagosPage() {
  return (
    <FeatureGuard
      flag="payments"
      fallback={<Proximamente featureName="Historial y Gestión de Pagos" />}
    >
      <PagosView />
    </FeatureGuard>
  );
}
