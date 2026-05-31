import { useMemo } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'

interface PersonalizedResult {
  topAssets: Asset[]
  isLoading: boolean
}

// Returns top 5 most active assets by volume24h.
// Redux/viewCount integration is deferred — will be swapped in when the watchlist slice is added.
export function usePersonalized(useMock = true): PersonalizedResult {
  const topAssets = useMemo(() => {
    if (useMock) {
      const sorted = [...MOCK_PRICES].sort((a, b) => b.volume24h - a.volume24h)
      const top = sorted.slice(0, 5)
      console.debug('[usePersonalized] topAssets=', top.map((a) => a.symbol))
      return top
    }
    // TODO: real impl — GET /api/user/personalized
    return [] as Asset[]
  }, [useMock])

  return {
    topAssets,
    isLoading: false,
  }
}
