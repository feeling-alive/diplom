// Currency-aware money formatting (Задача 6).
//
// All asset prices in the app are USD-denominated. A module-level singleton holds
// the user's chosen display currency + USD→currency rates so that every existing
// `formatPrice(...)` call site converts automatically — no per-component plumbing.
// CurrencyContext keeps this singleton in sync (setCurrencyState) and re-renders
// the visible pages on change.
//
// NB: forex *pairs* (e.g. EUR-USD = 1.08) are not USD amounts, so they are never
// converted — only crypto/stock/index prices and USD aggregates (volume, cap).

export type Currency = 'USD' | 'EUR' | 'RUB' | 'BTC'

export const CURRENCIES: Currency[] = ['USD', 'EUR', 'RUB', 'BTC']

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$', EUR: '€', RUB: '₽', BTC: '₿',
}

interface CurrencyState {
  currency: Currency
  // USD→currency multiplier. e.g. rates.RUB = 90 means 1 USD = 90 ₽.
  rates: Record<Currency, number>
}

// Sensible offline defaults; overwritten by live rates via setCurrencyState.
let currencyState: CurrencyState = {
  currency: 'USD',
  rates: { USD: 1, EUR: 0.92, RUB: 90, BTC: 1 / 65000 },
}

export function setCurrencyState(next: CurrencyState): void {
  currencyState = next
}

export function getCurrencyState(): CurrencyState {
  return currencyState
}

// Convert a USD amount into the active display currency.
export function convertFromUsd(usd: number, currency: Currency = currencyState.currency): number {
  const rate = currencyState.rates[currency] ?? 1
  return usd * rate
}

function withSymbol(num: string, currency: Currency): string {
  const sym = CURRENCY_SYMBOL[currency]
  // ₽ reads naturally as a suffix; the others as a prefix.
  return currency === 'RUB' ? `${num} ${sym}` : `${sym}${num}`
}

export function formatPrice(price: number, type?: string): string {
  if (price == null || Number.isNaN(price)) return '—'

  // Forex pair rates are not USD amounts — show as-is, never converted.
  if (type === 'forex') return price.toFixed(4)

  const v = convertFromUsd(price)
  const { currency } = currencyState

  // BTC display benefits from more precision (values are tiny in ₿).
  if (currency === 'BTC') {
    const d = v < 1 ? 6 : 4
    return withSymbol(v.toFixed(d), currency)
  }

  if (v >= 1_000_000) return withSymbol((v / 1_000_000).toFixed(2) + 'M', currency)
  if (v >= 1000) return withSymbol(v.toLocaleString('en-US', { maximumFractionDigits: 2 }), currency)
  const d = v < 0.01 ? 6 : v < 1 ? 4 : v < 10 ? 3 : 2
  return withSymbol(v.toFixed(d), currency)
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

export function formatVolume(vol: number): string {
  if (!vol) return '—'
  const v = convertFromUsd(vol)
  const sym = CURRENCY_SYMBOL[currencyState.currency]
  if (v >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`
  return `${sym}${(v / 1_000).toFixed(1)}K`
}

export function formatMarketCap(cap: number): string {
  if (!cap) return '—'
  const v = convertFromUsd(cap)
  const sym = CURRENCY_SYMBOL[currencyState.currency]
  if (v >= 1_000_000_000_000) return `${sym}${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(2)}B`
  return `${sym}${(v / 1_000_000).toFixed(1)}M`
}
