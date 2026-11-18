'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  formatMoney,
  isValidCurrency,
  isValidLocale,
} from '@packages/shared-types';
import { fetchTenantSettings } from './api/settings';

export interface MoneyContextValue {
  format: (value: number | string) => string;
  currency: string;
  locale: string;
  refresh: () => Promise<void>;
}

const buildValue = (currency: string, locale: string, refresh: () => Promise<void>): MoneyContextValue => ({
  format: (value) => formatMoney(value, { currency, locale }),
  currency,
  locale,
  refresh,
});

const DEFAULT_VALUE = buildValue(DEFAULT_CURRENCY, DEFAULT_LOCALE, async () => undefined);

const MoneyContext = createContext<MoneyContextValue>(DEFAULT_VALUE);

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState({ currency: DEFAULT_CURRENCY, locale: DEFAULT_LOCALE });

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTenantSettings();
      setSettings({
        currency: isValidCurrency(data?.currency) ? data.currency : DEFAULT_CURRENCY,
        locale: isValidLocale(data?.locale) ? data.locale : DEFAULT_LOCALE,
      });
    } catch {
      setSettings({ currency: DEFAULT_CURRENCY, locale: DEFAULT_LOCALE });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => buildValue(settings.currency, settings.locale, refresh),
    [settings, refresh]
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney(): MoneyContextValue {
  return useContext(MoneyContext);
}
