import React from 'react';
import { MoneyProvider } from '../../../../../lib/money';

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <MoneyProvider>{children}</MoneyProvider>;
}
