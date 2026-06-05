import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the price source so totals are computed against fixed prices.
vi.mock('../usePrices', () => ({
  usePrices: () => ({
    all: [
      { symbol: 'BTC-USDT', price: 70000 },
      { symbol: 'ETH-USDT', price: 4000 },
    ],
  }),
}))

import { useHoldings } from '../useHoldings'

describe('useHoldings', () => {
  beforeEach(() => localStorage.clear())

  it('returns an empty summary when there are no holdings', () => {
    const { result } = renderHook(() => useHoldings())
    expect(result.current.isEmpty).toBe(true)
    expect(result.current.totalValue).toBe(0)
    expect(result.current.totalPnl).toBe(0)
  })

  it('computes value, cost and pnl from holdings + live prices', () => {
    localStorage.setItem('fintrack_holdings_v1', JSON.stringify([
      { symbol: 'BTC-USDT', amount: 1, avgPrice: 60000 },
      { symbol: 'ETH-USDT', amount: 2, avgPrice: 3000 },
    ]))
    const { result } = renderHook(() => useHoldings())
    // value = 1*70000 + 2*4000 = 78000; cost = 60000 + 6000 = 66000
    expect(result.current.totalValue).toBe(78000)
    expect(result.current.totalCost).toBe(66000)
    expect(result.current.totalPnl).toBe(12000)
    expect(result.current.pnlPercent).toBeCloseTo((12000 / 66000) * 100, 4)
    expect(result.current.isEmpty).toBe(false)
  })

  it('falls back to avgPrice when a symbol has no live price', () => {
    localStorage.setItem('fintrack_holdings_v1', JSON.stringify([
      { symbol: 'XYZ-USDT', amount: 3, avgPrice: 100 },
    ]))
    const { result } = renderHook(() => useHoldings())
    expect(result.current.totalValue).toBe(300)
    expect(result.current.totalPnl).toBe(0)
  })
})
