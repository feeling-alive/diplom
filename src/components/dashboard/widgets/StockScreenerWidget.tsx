import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { symbol: string; price: number; change: number; pe: number; div: number }
const ROWS: Row[] = [
  { symbol: 'AAPL', price: 184.20, change: 1.4, pe: 28.4, div: 0.55 },
  { symbol: 'MSFT', price: 412.85, change: -0.6, pe: 34.1, div: 0.72 },
  { symbol: 'NVDA', price: 950.00, change: 3.8, pe: 65.2, div: 0.03 },
  { symbol: 'TSLA', price: 178.50, change: -2.1, pe: 47.6, div: 0.00 },
  { symbol: 'GOOG', price: 162.40, change: 0.8, pe: 25.1, div: 0.00 },
  { symbol: 'AMZN', price: 184.30, change: 1.2, pe: 52.0, div: 0.00 },
]

type Props = WidgetSizeProps

export default function StockScreenerWidget({ gridW = 3, gridH = 2 }: Props) {
  const limit = gridH >= 3 ? 6 : 4
  console.debug('[StockScreenerWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.8fr 0.7fr',
        fontSize: 9, color: 'var(--muted)', fontWeight: 600,
        padding: '3px 0', borderBottom: '1px solid var(--border)',
      }}>
        <span>Тикер</span><span style={{ textAlign: 'right' }}>Цена</span><span style={{ textAlign: 'right' }}>24ч</span><span style={{ textAlign: 'right' }}>P/E</span><span style={{ textAlign: 'right' }}>Div%</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {ROWS.slice(0, limit).map((r) => (
          <div key={r.symbol} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.8fr 0.7fr',
            padding: '5px 0', borderBottom: '1px solid var(--border)',
            fontSize: 10, fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.symbol}</span>
            <span style={{ textAlign: 'right' }}>${r.price.toFixed(2)}</span>
            <span style={{ textAlign: 'right', color: r.change >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
              {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
            </span>
            <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{r.pe.toFixed(1)}</span>
            <span style={{ textAlign: 'right', color: 'var(--muted)' }}>{r.div.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
