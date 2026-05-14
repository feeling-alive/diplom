import { useMemo } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'

export interface PriceMap {
  bySymbol: Record<string, Asset>
  cryptos: Asset[]
  stocks: Asset[]
  forex: Asset[]
  indices: Asset[]
  all: Asset[]
}

export function usePrices(): PriceMap {
  return useMemo(() => {
    const all = MOCK_PRICES
    const bySymbol: Record<string, Asset> = {}
    for (const a of all) bySymbol[a.symbol] = a

    return {
      bySymbol,
      cryptos: all.filter((a) => a.type === 'crypto'),
      stocks: all.filter((a) => a.type === 'stock'),
      forex: all.filter((a) => a.type === 'forex'),
      indices: all.filter((a) => a.type === 'index'),
      all,
    }
  }, [])
}
