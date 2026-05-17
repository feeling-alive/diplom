import type { WidgetSizeProps } from '../../../types/widgets.types'

type Cell = { symbol: string; change: number; cap: number }
const DATA: Cell[] = [
  { symbol: 'BTC', change: 2.4, cap: 1200 },
  { symbol: 'ETH', change: -1.2, cap: 420 },
  { symbol: 'SOL', change: 5.8, cap: 90 },
  { symbol: 'BNB', change: 0.6, cap: 88 },
  { symbol: 'XRP', change: -3.1, cap: 60 },
  { symbol: 'DOGE', change: 8.7, cap: 28 },
  { symbol: 'ADA', change: -0.8, cap: 22 },
  { symbol: 'AVAX', change: 4.2, cap: 18 },
  { symbol: 'DOT', change: -2.4, cap: 12 },
  { symbol: 'MATIC', change: 1.7, cap: 10 },
  { symbol: 'LINK', change: 3.5, cap: 9 },
  { symbol: 'TRX', change: -0.3, cap: 8 },
]

function bgColor(change: number): string {
  if (change >= 5) return '#16a34a'
  if (change >= 2) return '#22c55e'
  if (change >= 0) return '#86efac'
  if (change >= -2) return '#fca5a5'
  if (change >= -5) return '#ef4444'
  return '#b91c1c'
}

type Props = WidgetSizeProps

export default function HeatmapWidget({ gridW = 4, gridH = 2 }: Props) {
  const total = DATA.reduce((s, c) => s + c.cap, 0)
  const cols = gridW >= 4 ? 6 : 4
  console.debug('[HeatmapWidget] gridW=%d gridH=%d cols=%d', gridW, gridH, cols)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 3, overflow: 'hidden',
    }}>
      {DATA.slice(0, cols * (gridH >= 3 ? 3 : 2)).map((c) => {
        const w = Math.max(0.4, c.cap / total * 8)
        return (
          <div key={c.symbol} style={{
            background: bgColor(c.change),
            borderRadius: 4,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700,
            padding: 4, overflow: 'hidden',
            opacity: 0.55 + Math.min(w, 1.4) * 0.3,
          }}>
            <span style={{ fontSize: 11 }}>{c.symbol}</span>
            <span style={{ fontSize: 9, opacity: 0.9 }}>{c.change > 0 ? '+' : ''}{c.change.toFixed(1)}%</span>
          </div>
        )
      })}
    </div>
  )
}
