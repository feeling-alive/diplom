import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import INITIAL_PRICES from '../data/prices.json'
import { USE_MOCK } from '../lib/env'

interface AssetPriceResult {
  price: number
  change24h: number
  isLoading: boolean
  isConnected: boolean
}

// Fetch a single non-crypto quote. Pure (no component state) so TanStack Query can
// cache it per (type, symbol) — Задача 2: повторный заход на актив не грузит заново.
async function fetchQuote(symbol: string, type: Asset['type']): Promise<{ price: number; change24h: number }> {
  if (type === 'index') {
    // [Задача 3] Индексы не отдаются бесплатным Finnhub — берём стабильный снимок из
    // data/prices.json, не обращаясь к /api/quotes/stock (иначе вернулся бы мусор/0).
    const snap = (INITIAL_PRICES as Asset[]).find((a) => a.symbol === symbol)
    console.warn('[useAssetPrice] index %s: живого источника нет, снимок=%s', symbol, snap?.price)
    return { price: snap?.price ?? 0, change24h: snap?.change24h ?? 0 }
  }
  if (type === 'forex') {
    const [base, quote] = symbol.replace('-', '/').split('/')
    const res = await fetch(`/api/quotes/forex/${base}/${quote}`)
    if (!res.ok) throw new Error(`quotes/forex ${res.status}`)
    const json = (await res.json()) as { rate: number }
    console.debug('[useAssetPrice] %s backend rate=%s', symbol, json.rate)
    return { price: json.rate, change24h: 0 }
  }
  if (type === 'crypto') {
    // Backend OKX REST proxy (Redis-cached) — replaces the fragile direct
    // browser->OKX WebSocket that broke on CORS/blocked networks.
    const res = await fetch(`/api/quotes/crypto/${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`quotes/crypto ${res.status}`)
    const json = (await res.json()) as { price: number; changePercent: number }
    const safePrice = Number.isFinite(json.price) ? json.price : 0
    const safeChange = Number.isFinite(json.changePercent) ? json.changePercent : 0
    console.info('[useAssetPrice] %s backend crypto price=%s change=%s', symbol, safePrice, safeChange)
    return { price: safePrice, change24h: safeChange }
  }
  // stock
  const res = await fetch(`/api/quotes/stock/${symbol}`, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`quotes/stock ${res.status}`)
  const json = (await res.json()) as { price: number; changePercent: number }
  const safePrice = Number.isFinite(json.price) ? json.price : 0
  const safeChange = Number.isFinite(json.changePercent) ? json.changePercent : 0
  console.info('[useAssetPrice] %s backend price=%s change=%s', symbol, safePrice, safeChange)
  return { price: safePrice, change24h: safeChange }
}

export function useAssetPrice(
  symbol: string,
  type: Asset['type'],
  useMock = USE_MOCK,
): AssetPriceResult {
  const mockResult = useMemo<AssetPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol)
    if (!asset) {
      console.debug('[useAssetPrice] symbol not found in mock:', symbol)
    } else {
      console.debug('[useAssetPrice] %s mock=true price=%s', symbol, asset.price)
    }
    return {
      price: asset?.price ?? 0,
      change24h: asset?.change24h ?? 0,
      isLoading: false,
      isConnected: false,
    }
  }, [symbol])

  // All non-mock quotes (crypto/stock/forex/index) go through the same cached
  // query. Crypto polls faster (15s) for a near-live feel; the old direct OKX
  // WebSocket was removed — it broke whenever the browser couldn't reach
  // okx.com (CORS / blocked network), leaving prices stuck at 0.
  const query = useQuery({
    queryKey: ['assetPrice', type, symbol],
    enabled: !useMock && !!symbol,
    refetchInterval: type === 'index' ? false : type === 'crypto' ? 15_000 : 60_000,
    refetchOnMount: false,
    queryFn: () => fetchQuote(symbol, type),
  })

  if (useMock) return mockResult
  return {
    price: query.data?.price ?? 0,
    change24h: query.data?.change24h ?? 0,
    isLoading: query.isLoading,
    isConnected: false,
  }
}
