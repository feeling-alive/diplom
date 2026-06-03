// Global display currency (Задача 6), modeled on AuthContext — the only kind of
// cross-cutting global ARCHITECTURE allows. Holds the chosen currency (persisted to
// localStorage) and live USD→currency rates derived from usePrices, and pushes both
// into the format.ts singleton so every formatPrice() call across the app converts.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { usePrices } from '../hooks/usePrices'
import {
  CURRENCIES,
  setCurrencyState,
  convertFromUsd,
  type Currency,
} from '../utils/format'

const LS_CURRENCY = 'fintrack_currency'

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (c: Currency) => void
  /** Convert a USD amount into the active currency (for non-formatPrice call sites). */
  convert: (usd: number) => number
  rates: Record<Currency, number>
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

function loadCurrency(): Currency {
  try {
    const saved = localStorage.getItem(LS_CURRENCY)
    if (saved && (CURRENCIES as string[]).includes(saved)) return saved as Currency
  } catch { /* ignore */ }
  return 'USD'
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyRaw] = useState<Currency>(loadCurrency)
  const { bySymbol } = usePrices()

  // Derive USD→currency multipliers from live quotes, falling back to offline
  // defaults until the first tick lands.
  const rates = useMemo<Record<Currency, number>>(() => {
    const usdEur = bySymbol['USD-EUR']?.price
    const usdRub = bySymbol['USD-RUB']?.price
    const btcUsd = bySymbol['BTC-USDT']?.price
    return {
      USD: 1,
      EUR: usdEur && usdEur > 0 ? usdEur : 0.92,
      RUB: usdRub && usdRub > 0 ? usdRub : 90,
      BTC: btcUsd && btcUsd > 0 ? 1 / btcUsd : 1 / 65000,
    }
  }, [bySymbol])

  // Keep the format.ts singleton in sync so formatPrice/formatVolume/... convert.
  useEffect(() => {
    setCurrencyState({ currency, rates })
    console.debug('[CurrencyContext] currency=%s rates=%o', currency, rates)
  }, [currency, rates])

  const setCurrency = (c: Currency) => {
    console.debug('[CurrencyContext] setCurrency %s', c)
    setCurrencyRaw(c)
    try { localStorage.setItem(LS_CURRENCY, c) } catch { /* ignore */ }
  }

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    convert: (usd: number) => convertFromUsd(usd, currency),
    rates,
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (ctx === null) {
    throw new Error('useCurrency must be used within <CurrencyProvider>')
  }
  return ctx
}
