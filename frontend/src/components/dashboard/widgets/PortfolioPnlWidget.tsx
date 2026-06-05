import { useMemo, useEffect, useState } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

interface Holding { symbol: string; amount: number; avgPrice: number }

const STORAGE_KEY = 'fintrack_holdings_v1'

function loadHoldings(): Holding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Holding[]
  } catch { return [] }
}

function saveHoldings(holdings: Holding[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)) } catch { /* ignore */ }
}

export default function PortfolioPnlWidget({ gridW = 3, gridH = 1 }: Props) {
  const [holdings] = useState<Holding[]>(loadHoldings)
  const { all } = usePrices()

  // Persist defaults on first mount if empty (provides demo content)
  useEffect(() => {
    if (holdings.length === 0) {
      const demo: Holding[] = [
        { symbol: 'BTC-USDT', amount: 0.05, avgPrice: 62000 },
        { symbol: 'ETH-USDT', amount: 0.5, avgPrice: 3000 },
        { symbol: 'SOL-USDT', amount: 5, avgPrice: 145 },
      ]
      saveHoldings(demo)
    }
  }, [holdings.length])

  const pnl = useMemo(() => {
    if (holdings.length === 0) return null
    const priceMap = new Map(all.map(a => [a.symbol, a.price]))
    let totalCost = 0
    let totalValue = 0
    const items = holdings.map((h) => {
      const current = priceMap.get(h.symbol) ?? h.avgPrice
      const cost = h.amount * h.avgPrice
      const value = h.amount * current
      totalCost += cost
      totalValue += value
      return { symbol: h.symbol, cost, value, pnl: value - cost, current }
    })
    const totalPnl = totalValue - totalCost
    const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
    return { items, totalCost, totalValue, totalPnl, pct }
  }, [holdings, all])

  console.debug('[PortfolioPnlWidget] gridW=%d gridH=%d holdings=%d', gridW, gridH, holdings.length)

  if (!pnl || holdings.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, padding: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Нет активов</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Добавьте активы в избранное</span>
      </div>
    )
  }

  const positive = pnl.totalPnl >= 0
  const color = positive ? '#16a34a' : '#ef4444'

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      gap: 8, overflow: 'hidden', padding: 4,
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>P&L</span>
        <span style={{ fontSize: gridW >= 3 ? 16 : 13, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
          {positive ? '+' : ''}{pnl.totalPnl.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} $
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {positive ? '+' : ''}{pnl.pct.toFixed(1)}%
        </span>
      </div>
      {gridW >= 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Стоим.</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {pnl.totalValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} $
          </span>
        </div>
      )}
      {gridW >= 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Активов</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
            {pnl.items.length}
          </span>
        </div>
      )}
    </div>
  )
}
