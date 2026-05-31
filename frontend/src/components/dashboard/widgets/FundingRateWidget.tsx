import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { symbol: string; rate: number }
const ROWS: Row[] = [
  { symbol: 'BTC', rate: 0.012 },
  { symbol: 'ETH', rate: 0.008 },
  { symbol: 'SOL', rate: 0.024 },
  { symbol: 'XRP', rate: -0.005 },
  { symbol: 'DOGE', rate: 0.041 },
  { symbol: 'BNB', rate: 0.003 },
]

type Props = WidgetSizeProps

export default function FundingRateWidget({ gridW = 2, gridH = 2 }: Props) {
  const limit = gridW >= 3 ? 6 : 4
  console.debug('[FundingRateWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: 'var(--muted)', fontWeight: 600,
        padding: '2px 0', borderBottom: '1px solid var(--border)',
      }}>
        <span>Актив</span><span>Funding · 8ч</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {ROWS.slice(0, limit).map((r) => (
          <div key={r.symbol} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '5px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{r.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.rate >= 0 ? '#16a34a' : '#ef4444' }}>
              {r.rate >= 0 ? '+' : ''}{(r.rate * 100).toFixed(3)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
