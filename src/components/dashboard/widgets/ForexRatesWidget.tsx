import { useForexRate } from '../../../hooks/useForexRate'
import type { WidgetSizeProps } from '../../../types/widgets.types'

const PAIRS = [
  { from: 'EUR', to: 'USD', label: 'EUR/USD' },
  { from: 'GBP', to: 'USD', label: 'GBP/USD' },
  { from: 'USD', to: 'JPY', label: 'USD/JPY' },
  { from: 'USD', to: 'CHF', label: 'USD/CHF' },
]

type Props = WidgetSizeProps

export default function ForexRatesWidget({ gridW = 2, gridH = 2 }: Props) {
  const horizontal = gridH === 1
  const visiblePairs = horizontal ? PAIRS.slice(0, 3) : PAIRS

  console.debug('[ForexRatesWidget] gridW=%d gridH=%d layout=%s pairs=%d', gridW, gridH, horizontal ? 'horizontal' : 'vertical', visiblePairs.length)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        gap: horizontal ? 12 : 6,
        overflow: 'hidden',
        boxSizing: 'border-box',
        alignItems: horizontal ? 'center' : 'stretch',
      }}
    >
      {visiblePairs.map((pair) => (
        <ForexRow key={pair.label} from={pair.from} to={pair.to} label={pair.label} horizontal={horizontal} />
      ))}
    </div>
  )
}

function ForexRow({ from, to, label, horizontal }: { from: string; to: string; label: string; horizontal: boolean }) {
  const { rate, isLoading } = useForexRate(from, to)

  const changes: Record<string, number> = {
    'EUR/USD': 0.3,
    'GBP/USD': -0.2,
    'USD/JPY': 0.15,
    'USD/CHF': -0.05,
  }
  const change = changes[label] ?? 0
  const isPositive = change >= 0

  if (horizontal) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, gap: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{isLoading ? '...' : rate.toFixed(4)}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: isPositive ? 'var(--green)' : 'var(--accent)' }}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
          {isLoading ? '...' : rate.toFixed(4)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: isPositive ? 'var(--green)' : 'var(--accent)' }}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
