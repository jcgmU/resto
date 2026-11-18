import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@packages/ui-components/src/bento/bento.css', () => ({}), { virtual: true });
jest.mock('next/font/google', () => ({
  Bricolage_Grotesque: () => ({ variable: '--font-bricolage', className: 'font-bricolage' }),
  DM_Sans: () => ({ variable: '--font-dm-sans', className: 'font-dm-sans' }),
}));

import ClientRootPage from '../src/app/page';
import { metadata } from '../src/app/layout';

describe('B1: Landing PWA — Lima & Tinta', () => {
  test('Renderiza branding Resto, tarjeta BentoCard y texto de escaneo de QR', () => {
    const { container } = render(<ClientRootPage />);

    // Branding Resto y Menú Digital
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Resto|Menú Digital/i);
    expect(screen.getByText(/escanea el.*qr.*mesa/i)).toBeInTheDocument();

    // BentoCard papel
    const bentoCard = container.querySelector('[data-component="bento-card"]');
    expect(bentoCard).toBeInTheDocument();

    // Fondo hueso en contenedor principal
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer.getAttribute('style') || '').toContain('var(--bento-page-bg-pwa)');

    // Cero hex #666 y cero hex inline en todo el árbol de la landing
    const htmlContent = container.innerHTML;
    expect(htmlContent).not.toContain('#666');
    expect(htmlContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);

    // Accesibilidad: todo SVG tiene aria-hidden
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('Metadata de layout incluye manifest y branding Resto', () => {
    expect(metadata.title).toBe('Resto - Menú Digital');
    expect(metadata.manifest).toBe('/manifest.json');
  });
});
