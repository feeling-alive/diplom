import { useMemo } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import { USE_MOCK } from '../lib/env'
import { usePrices } from './usePrices'

interface PersonalizedResult {
  topAssets: Asset[]
  isLoading: boolean
}

// Returns the top 5 most active assets by 24h volume. Real source is the shared
// usePrices() store (live OKX/forex/stock data via the backend proxy); the mock
// branch (useMock=true) keeps the static snapshot for offline/dev work.
export function usePersonalized(useMock = USE_MOCK): PersonalizedResult {
  const prices = usePrices()

  const topAssets = useMemo(() => {
    const source = useMock ? MOCK_PRICES : prices.all
    const sorted = [...source].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    const top = sorted.slice(0, 5)
    console.debug(
      '[usePersonalized] source=%s topAssets=%o',
      useMock ? 'mock' : 'live',
      top.map((a) => a.symbol),
    )
    return top
  }, [useMock, prices.all])

  return {
    topAssets,
    // In mock mode data is synchronous; in live mode follow the prices store.
    isLoading: useMock ? false : prices.isLoading,
  }
}
