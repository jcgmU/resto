import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FeatureGuard } from '@packages/ui-components';
import { FeatureFlagsProvider } from '../src/components/FeatureFlagsProvider';

describe('HALLAZGO 1: FeatureFlagsProvider & Root Layout (TDD Rojo)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_FLAGS;

  afterEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS = originalEnv;
  });

  test('FeatureFlagsProvider monta EnvFeatureFlagProvider y habilita FeatureGuard cuando flag está en env', () => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'kitchen-display:true,payments:true,analytics:false';

    render(
      <FeatureFlagsProvider>
        <FeatureGuard flag="kitchen-display">
          <div data-testid="kds-active">KDS Habilitado</div>
        </FeatureGuard>
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId('kds-active')).toBeInTheDocument();
    expect(screen.queryByTestId('proximamente')).not.toBeInTheDocument();
  });

  test('FeatureFlagsProvider mantiene apagadas las flags no habilitadas (fail-closed)', () => {
    process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'kitchen-display:true,payments:true,analytics:false';

    render(
      <FeatureFlagsProvider>
        <FeatureGuard flag="analytics">
          <div data-testid="analytics-active">Analytics Habilitado</div>
        </FeatureGuard>
      </FeatureFlagsProvider>
    );

    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-active')).not.toBeInTheDocument();
  });
});
