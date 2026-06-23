import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../../../lib/env'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { symbol: string; price: number; change: number }

// Расширенный список (3.9): крупнейшие ликвидные тикеры US-рынка. Бэкенд тянет
// их батчем через /api/quotes/stocks (Finnhub), per-symbol ошибки отсеиваются.
const SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOG', 'AMZN', 'META', 'JPM',
  'V', 'WMT', 'NFLX', 'AMD', 'DIS', 'KO', 'INTC', 'BA',
]

const MOCK_ROWS: Row[] = [
  { symbol: 'AAPL', price: 184.2, change: 1.4 }, { symbol: 'MSFT', price: 412.85, change: -0.6 },
  { symbol: 'NVDA', price: 950, change: 3.8 }, { symbol: 'TSLA', price: 178.5, change: -2.1 },
  { symbol: 'GOOG', price: 162.4, change: 0.8 }, { symbol: 'AMZN', price: 184.3, change: 1.2 },
  { symbol: 'META', price: 505.1, change: 2.2 }, { symbol: 'JPM', price: 198.7, change: -0.4 },
  { symbol: 'V', price: 275.3, change: 0.5 }, { symbol: 'WMT', price: 67.9, change: 0.9 },
  { symbol: 'NFLX', price: 632.4, change: -1.1 }, { symbol: 'AMD', price: 162.8, change: 4.1 },
  { symbol: 'DIS', price: 102.5, change: -0.7 }, { symbol: 'KO', price: 61.2, change: 0.2 },
  { symbol: 'INTC', price: 31.4, change: -1.8 }, { symbol: 'BA', price: 178.9, change: 1.6 },
]

interface StocksPayload {
  quotes: Array<{ symbol: string; price?: number; changePercent?: number; error?: string }>
}

async function fetchStocks(): Promise<Row[]> {
  const res = await fetch(`/api/quotes/stocks?symbols=${SYMBOLS.join(',')}`)
  if (!res.ok) throw new Error(`stocks ${res.status}`)
  const json = (await res.json()) as StocksPayload
  const rows = json.quotes
    .filter((q) => !q.error && Number.isFinite(q.price))
    .map((q) => ({ symbol: q.symbol, price: q.price ?? 0, change: q.changePercent ?? 0 }))
  console.debug('[StockScreenerWidget] fetched %d rows', rows.length)
  return rows
}

type Props = WidgetSizeProps

export default function StockScreenerWidget({ gridW = 3, gridH = 2 }: Props) {
  const [topGainers, setTopGainers] = useState(true)
  const limit = gridH >= 4 ? SYMBOLS.length : gridH >= 3 ? 8 : gridH >= 2 ? 6 : 4

  const { data } = useQuery<Row[], Error>({
    queryKey: ['stocks-screener', SYMBOLS.join(',')],
    queryFn: fetchStocks,
    enabled: !USE_MOCK,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const rows = ((USE_MOCK ? MOCK_ROWS : data) ?? MOCK_ROWS)
    .slice()
    .sort((a, b) => (topGainers ? b.change - a.change : a.change - b.change))
  console.debug('[StockScreenerWidget] gridW=%d gridH=%d sort=%s rows=%d', gridW, gridH, topGainers ? 'gainers' : 'losers', rows.length)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
        <button
          onClick={() => setTopGainers((v) => !v)}
          style={{
            fontSize: 9, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', padding: '1px 6px',
            fontFamily: 'inherit',
          }}
        >
          {topGainers ? '↑ Лидеры роста' : '↓ Лидеры падения'}
        </button>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr',
        fontSize: 9, color: 'var(--muted)', fontWeight: 600,
        padding: '3px 0', borderBottom: '1px solid var(--border)',
      }}>
        <span>Тикер</span><span style={{ textAlign: 'right' }}>Цена</span><span style={{ textAlign: 'right' }}>24ч</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.slice(0, limit).map((r) => (
          <div key={r.symbol} style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr',
            padding: '5px 0', borderBottom: '1px solid var(--border)',
            fontSize: 10, fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.symbol}</span>
            <span style={{ textAlign: 'right' }}>${r.price.toFixed(2)}</span>
            <span style={{ textAlign: 'right', color: r.change >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
              {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
