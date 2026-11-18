import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureFlagProviderRoot, StaticFeatureFlagProvider } from '@packages/ui-components';
import DevComponentesPage from '../src/app/(panel)/dev/componentes/page';

const renderWithFlag = (enabled: boolean) =>
  render(
    <FeatureFlagProviderRoot provider={new StaticFeatureFlagProvider({ 'dev-components': enabled } as any)}>
      <DevComponentesPage />
    </FeatureFlagProviderRoot>
  );

describe('/dev/componentes (muestra del sistema de diseño)', () => {
  test('sin el flag dev-components no muestra la muestra', () => {
    renderWithFlag(false);
    expect(screen.queryByTestId('dev-componentes')).not.toBeInTheDocument();
    expect(screen.getByText(/Próximamente/i)).toBeInTheDocument();
  });

  test('con el flag muestra cada componente y estado', () => {
    renderWithFlag(true);
    const page = screen.getByTestId('dev-componentes');
    for (const status of ['available', 'occupied', 'reserved']) {
      expect(page.querySelector(`[data-component="status-card"][data-status="${status}"]`)).not.toBeNull();
    }
    expect(page.querySelector('[data-part="blob"][data-variant="progress"]')).not.toBeNull();
    for (const variant of ['primary', 'secondary', 'danger', 'link']) {
      expect(page.querySelector(`[data-component="button"][data-variant="${variant}"]`)).not.toBeNull();
    }
    expect(page.querySelectorAll('[data-component="avatar"]').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  test('el botón abre el modal de muestra y Cancelar lo cierra', () => {
    renderWithFlag(true);
    fireEvent.click(screen.getByRole('button', { name: /Abrir modal/i }));
    expect(screen.getByRole('dialog', { name: /Nueva mesa/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
