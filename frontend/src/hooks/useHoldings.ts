import { useMemo, useState } from 'react'
import { usePrices } from './usePrices'

// Holdings live in localStorage (written by the portfolio UI). This hook reads
// them and merges live prices from usePrices to derive portfolio totals — the
// single source of truth for KpiStrip + PortfolioHero (no more hardcoded numbers).

export interface Holding { symbol: string; amount: number; avgPrice: number }

const STORAGE_KEY = 'fintrack_holdings_v1'

export function loadHoldings(): Holding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Holding[]
  } catch {
    return []
  }
}

export interface PortfolioSummary {
  holdings: Holding[]
  totalValue: number
  totalCost: number
  totalPnl: number
  pnlPercent: number
  isEmpty: boolean
}

export function useHoldings(): PortfolioSummary {
  const [holdings] = useState<Holding[]>(loadHoldings)
  const { all } = usePrices()

  return useMemo(() => {
    const priceMap = new Map(all.map((a) => [a.symbol, a.price]))
    let totalCost = 0
    let totalValue = 0
    for (const h of holdings) {
      const current = priceMap.get(h.symbol) ?? h.avgPrice
      totalCost += h.amount * h.avgPrice
      totalValue += h.amount * current
    }
    const totalPnl = totalValue - totalCost
    const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
    console.debug('[useHoldings] holdings=%d totalValue=%.2f pnl=%.2f%%', holdings.length, totalValue, pnlPercent)
    return {
      holdings,
      totalValue,
      totalCost,
      totalPnl,
      pnlPercent,
      isEmpty: holdings.length === 0,
    }
  }, [holdings, all])
}
