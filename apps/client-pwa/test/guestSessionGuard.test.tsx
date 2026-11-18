import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GuestSessionGuard } from '../src/components/GuestSessionGuard';
import { PwaApiClient } from '../src/lib/api';

describe('Bloque 4: GuestSessionGuard hidratación y gate de montaje', () => {
  beforeEach(() => {
    sessionStorage.clear();
    PwaApiClient.guestToken = null;
  });

  test('Render inicial (SSR / pre-mount) renderiza placeholder neutro, y tras mount decide sin token', async () => {
    // Simular que en pre-mount no hay mismatch
    const { container, rerender } = render(
      <GuestSessionGuard>
        <div data-testid="protected-content">Contenido Protegido</div>
      </GuestSessionGuard>
    );

    // En el DOM final (post-mount), sin token, muestra el mensaje de escaneo
    expect(await screen.findByText('Escanea el QR de tu mesa')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  test('Con token en storage, tras mount muestra los children', async () => {
    PwaApiClient.guestToken = 'valid-token';

    render(
      <GuestSessionGuard>
        <div data-testid="protected-content">Contenido Protegido</div>
      </GuestSessionGuard>
    );

    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();
  });

  test('U12: GuestSessionGuard utiliza tokens Bento Suite (--bento-page-bg-pwa, --bento-card-bg-solid, --bento-text-strong) y elimina #F5F5F7', async () => {
    const { container } = render(
      <GuestSessionGuard>
        <div data-testid="protected-content">Contenido Protegido</div>
      </GuestSessionGuard>
    );

    // Esperar al mount
    await screen.findByText('Escanea el QR de tu mesa');

    // Verificar que en ningún elemento exista el valor inline #F5F5F7
    const html = container.innerHTML;
    expect(html).not.toContain('#F5F5F7');
    expect(html).not.toContain('#f5f5f7');
    expect(html).toContain('var(--bento-page-bg-pwa)');
    expect(html).toContain('var(--bento-text-strong)');
  });
});

