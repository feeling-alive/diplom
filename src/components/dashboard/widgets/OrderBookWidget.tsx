import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { price: number; size: number }

const ASKS: Row[] = [
  { price: 67460, size: 0.42 },
  { price: 67455, size: 1.18 },
  { price: 67450, size: 0.66 },
  { price: 67445, size: 2.05 },
]
const BIDS: Row[] = [
  { price: 67435, size: 1.92 },
  { price: 67430, size: 0.31 },
  { price: 67425, size: 0.85 },
  { price: 67420, size: 1.47 },
]

type Props = WidgetSizeProps

export default function OrderBookWidget({ gridW = 2, gridH = 2 }: Props) {
  const maxSize = Math.max(...[...ASKS, ...BIDS].map((r) => r.size))
  const limit = gridH >= 3 ? 4 : 3
  console.debug('[OrderBookWidget] gridW=%d gridH=%d', gridW, gridH)

  const renderRow = (r: Row, side: 'ask' | 'bid') => {
    const pct = (r.size / maxSize) * 100
    const color = side === 'ask' ? '#ef4444' : '#16a34a'
    return (
      <div key={`${side}-${r.price}`} style={{
        position: 'relative', display: 'flex', justifyContent: 'space-between',
        padding: '2px 4px', fontSize: 10, fontVariantNumeric: 'tabular-nums',
      }}>
        <div style={{
          position: 'absolute', top: 0, [side === 'ask' ? 'right' : 'left']: 0,
          height: '100%', width: `${pct}%`,
          background: color, opacity: 0.12,
        }} />
        <span style={{ position: 'relative', color, fontWeight: 600 }}>{r.price.toLocaleString()}</span>
        <span style={{ position: 'relative', color: 'var(--text)' }}>{r.size.toFixed(3)}</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {ASKS.slice(0, limit).reverse().map((r) => renderRow(r, 'ask'))}
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--ink)',
          textAlign: 'center', padding: '3px 0',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        }}>67 440</div>
        {BIDS.slice(0, limit).map((r) => renderRow(r, 'bid'))}
      </div>
    </div>
  )
}
