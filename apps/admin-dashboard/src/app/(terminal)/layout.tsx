import React from 'react';
import type { Metadata } from 'next';
import TerminalShell from './TerminalShell';

export const metadata: Metadata = {
  title: 'Terminal Operativa - Restaurante OS',
  description: 'Terminal operativa para meseros, cocina y caja',
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}
