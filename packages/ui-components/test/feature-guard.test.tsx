import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  parseFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  StaticFeatureFlagProvider,
  EnvFeatureFlagProvider,
  FeatureGuard,
  FeatureFlagProviderRoot,
  Proximamente,
} from '../src';

describe('A. @packages/ui-components — FeatureGuard & Flags (Tests 1-14)', () => {
  describe('parseFeatureFlags (Tests 1-5)', () => {
    test('1. parseFeatureFlags(undefined) devuelve DEFAULT_FEATURE_FLAGS', () => {
      const result = parseFeatureFlags(undefined);
      expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
    });

    test('2. parseFeatureFlags("payments:true,analytics:true") activa solo esas dos sobre los defaults', () => {
      const result = parseFeatureFlags('payments:true,analytics:true');
      expect(result).toEqual({
        ...DEFAULT_FEATURE_FLAGS,
        payments: true,
        analytics: true,
      });
    });

    test('3. parseFeatureFlags("online-ordering:false") desactiva una flag que está ON por defecto', () => {
      const result = parseFeatureFlags('online-ordering:false');
      expect(result['online-ordering']).toBe(false);
      expect(result['table-qr']).toBe(true);
    });

    test('4. parseFeatureFlags("unknown-flag:true") ignora la clave desconocida y no lanza', () => {
      expect(() => {
        const result = parseFeatureFlags('unknown-flag:true');
        expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
      }).not.toThrow();
    });

    test('5. parseFeatureFlags("payments:si") (valor inválido) se trata como false y no lanza', () => {
      expect(() => {
        const result = parseFeatureFlags('payments:si');
        expect(result.payments).toBe(false);
      }).not.toThrow();
    });
  });

  describe('Providers (Tests 6-8)', () => {
    test('6. new StaticFeatureFlagProvider({ payments: true }).isEnabled("payments") === true; getAll() devuelve el merge con defaults', () => {
      const provider = new StaticFeatureFlagProvider({ payments: true });
      expect(provider.isEnabled('payments')).toBe(true);
      expect(provider.getAll()).toEqual({
        ...DEFAULT_FEATURE_FLAGS,
        payments: true,
      });
    });

    test('7. new StaticFeatureFlagProvider().isEnabled(<cualquier flag default-off>) === false (fail-closed)', () => {
      const provider = new StaticFeatureFlagProvider();
      expect(provider.isEnabled('kitchen-display')).toBe(false);
      expect(provider.isEnabled('payments')).toBe(false);
      expect(provider.isEnabled('analytics')).toBe(true);
      expect(provider.isEnabled('multi-language')).toBe(false);
    });

    test('8. EnvFeatureFlagProvider con NEXT_PUBLIC_FEATURE_FLAGS seteada refleja el parse', () => {
      const originalEnv = process.env.NEXT_PUBLIC_FEATURE_FLAGS;
      try {
        process.env.NEXT_PUBLIC_FEATURE_FLAGS = 'kitchen-display:true,payments:true';
        const provider = new EnvFeatureFlagProvider();
        expect(provider.isEnabled('kitchen-display')).toBe(true);
        expect(provider.isEnabled('payments')).toBe(true);
        expect(provider.isEnabled('analytics')).toBe(true);
      } finally {
        process.env.NEXT_PUBLIC_FEATURE_FLAGS = originalEnv;
      }
    });
  });

  describe('FeatureGuard (Tests 9-12)', () => {
    test('9. Flag ON (provider stub) -> renderiza children', () => {
      const provider = new StaticFeatureFlagProvider({ payments: true });
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <FeatureGuard flag="payments">
            <span data-testid="protected-content">Contenido Seguro</span>
          </FeatureGuard>
        </FeatureFlagProviderRoot>
      );
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByText('Contenido Seguro')).toBeInTheDocument();
    });

    test('10. Flag OFF -> renderiza <Proximamente /> por defecto (visible data-testid="proximamente")', () => {
      const provider = new StaticFeatureFlagProvider({ payments: false });
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <FeatureGuard flag="payments">
            <span data-testid="protected-content">Contenido Protegido</span>
          </FeatureGuard>
        </FeatureFlagProviderRoot>
      );
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    });

    test('11. Flag OFF + fallback custom -> renderiza el fallback y NO Proximamente', () => {
      const provider = new StaticFeatureFlagProvider({ payments: false });
      render(
        <FeatureFlagProviderRoot provider={provider}>
          <FeatureGuard flag="payments" fallback={<div data-testid="custom-fallback">Custom</div>}>
            <span data-testid="protected-content">Contenido Protegido</span>
          </FeatureGuard>
        </FeatureFlagProviderRoot>
      );
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('proximamente')).not.toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    test('12. Sin FeatureFlagProviderRoot en el árbol y flag default-off -> renderiza fallback (fail-closed, sin throw)', () => {
      expect(() => {
        render(
          <FeatureGuard flag="kitchen-display" fallback={<div data-testid="fail-closed-fallback">Fallback</div>}>
            <span data-testid="protected-content">Contenido</span>
          </FeatureGuard>
        );
      }).not.toThrow();
      expect(screen.getByTestId('fail-closed-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Proximamente (Tests 13-14)', () => {
    test('13. Renderiza con role="status" y el texto "Próximamente"', () => {
      render(<Proximamente />);
      const el = screen.getByRole('status');
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent(/Próximamente/i);
    });

    test('14. Con featureName="Pagos" muestra el nombre de la funcionalidad', () => {
      render(<Proximamente featureName="Pagos" />);
      const el = screen.getByRole('status');
      expect(el).toHaveTextContent(/Pagos/i);
    });
  });
});
