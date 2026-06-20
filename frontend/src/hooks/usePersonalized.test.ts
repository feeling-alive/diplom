import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Asset } from '../types/market.types'
import type { PriceMap } from './usePrices'

// Mock the shared prices store so the hook is tested in isolation (no network,
// no QueryClient).
const mockUsePrices = vi.fn<() => PriceMap>()
vi.mock('./usePrices', () => ({ usePrices: () => mockUsePrices() }))

import { usePersonalized } from './usePersonalized'

function asset(symbol: string, volume24h: number): Asset {
  return {
    symbol,
    name: symbol,
    type: 'crypto',
    price: 100,
    change24h: 1,
    volume24h,
    color: '#000',
  } as Asset
}

function priceMap(all: Asset[], isLoading = false): PriceMap {
  return {
    bySymbol: Object.fromEntries(all.map((a) => [a.symbol, a])),
    cryptos: all,
    stocks: [],
    forex: [],
    all,
    isLoading,
    lastUpdated: Date.now(),
  }
}

describe('usePersonalized', () => {
  beforeEach(() => mockUsePrices.mockReset())

  it('live mode: returns top 5 by 24h volume, descending', () => {
    const all = [
      asset('A', 10), asset('B', 50), asset('C', 30),
      asset('D', 90), asset('E', 5), asset('F', 70),
    ]
    mockUsePrices.mockReturnValue(priceMap(all))

    const { result } = renderHook(() => usePersonalized(false))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.topAssets.map((a) => a.symbol)).toEqual(['D', 'F', 'B', 'C', 'A'])
    expect(result.current.topAssets).toHaveLength(5)
  })

  it('live mode: propagates loading state from the prices store', () => {
    mockUsePrices.mockReturnValue(priceMap([], true))
    const { result } = renderHook(() => usePersonalized(false))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.topAssets).toEqual([])
  })

  it('mock mode: uses the static snapshot and is never loading', () => {
    mockUsePrices.mockReturnValue(priceMap([asset('LIVE', 999)]))
    const { result } = renderHook(() => usePersonalized(true))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.topAssets.length).toBeGreaterThan(0)
    // Must come from the mock snapshot, not the (mocked) live store.
    expect(result.current.topAssets.some((a) => a.symbol === 'LIVE')).toBe(false)
  })
})
