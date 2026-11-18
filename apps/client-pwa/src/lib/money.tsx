'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, formatMoney } from '@packages/shared-types';
import { PwaApiClient } from './api';

export interface MoneyContextValue {
  format: (value: number) => string;
  currency: string;
  locale: string;
}

function buildValue(currency: string, locale: string): MoneyContextValue {
  return { currency, locale, format: (value) => formatMoney(value, { currency, locale }) };
}

const MoneyContext = createContext<MoneyContextValue>(buildValue(DEFAULT_CURRENCY, DEFAULT_LOCALE));

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState({ currency: DEFAULT_CURRENCY as string, locale: DEFAULT_LOCALE as string });

  useEffect(() => {
    let active = true;
    PwaApiClient.getTenantSettings()
      .then((res) => {
        if (!active) return;
        const currency = typeof res?.currency === 'string' && res.currency ? res.currency : DEFAULT_CURRENCY;
        const locale = typeof res?.locale === 'string' && res.locale ? res.locale : DEFAULT_LOCALE;
        setSettings({ currency, locale });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => buildValue(settings.currency, settings.locale), [settings]);
  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney(): MoneyContextValue {
  return useContext(MoneyContext);
}
