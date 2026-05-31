import { useForexRate } from '../../../hooks/useForexRate'
import type { WidgetSizeProps } from '../../../types/widgets.types'

interface Pair { from: string; to: string; label: string }

const PAIRS: Pair[] = [
  { from: 'EUR', to: 'USD', label: 'EUR/USD' },
  { from: 'GBP', to: 'USD', label: 'GBP/USD' },
  { from: 'USD', to: 'JPY', label: 'USD/JPY' },
  { from: 'USD', to: 'CHF', label: 'USD/CHF' },
]

// Заглушечные % изменения — пока useForexRate не возвращает change, оставляем константы
const CHANGES: Record<string, number> = {
  'EUR/USD': 0.3,
  'GBP/USD': -0.2,
  'USD/JPY': 0.15,
  'USD/CHF': -0.05,
}

type Props = WidgetSizeProps

export default function ForexRatesWidget({ gridW = 2, gridH = 2 }: Props) {
  const horizontal = gridH === 1
  // 2x1 — 2 пары, 3x1 — 3 пары, 2x2 — все 4 пары в сетке 2x2
  const visiblePairs = horizontal ? PAIRS.slice(0, gridW) : PAIRS

  console.debug('[ForexRatesWidget] gridW=%d gridH=%d layout=%s pairs=%d', gridW, gridH, horizontal ? 'row' : 'grid', visiblePairs.length)

  if (horizontal) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${visiblePairs.length}, minmax(0, 1fr))`,
          gap: 8,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {visiblePairs.map((p) => <RowCell key={p.label} pair={p} />)}
      </div>
    )
  }

  // 2x2 — крупные карточки в сетке 2x2
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {visiblePairs.map((p) => <CardCell key={p.label} pair={p} />)}
    </div>
  )
}

function RowCell({ pair }: { pair: Pair }) {
  const { rate, isLoading } = useForexRate(pair.from, pair.to)
  const change = CHANGES[pair.label] ?? 0
  const positive = change >= 0
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: 8,
      background: 'var(--bg)',
      borderRadius: 8,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{pair.label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {isLoading ? '…' : Number.isFinite(rate) ? rate.toFixed(4) : '—'}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: positive ? 'var(--green)' : 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
        {positive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  )
}

function CardCell({ pair }: { pair: Pair }) {
  const { rate, isLoading } = useForexRate(pair.from, pair.to)
  const change = CHANGES[pair.label] ?? 0
  const positive = change >= 0
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 10,
      background: 'var(--bg)',
      borderRadius: 10,
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{pair.label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isLoading ? '…' : Number.isFinite(rate) ? rate.toFixed(4) : '—'}
      </span>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: positive ? 'var(--green)' : 'var(--accent)',
        background: positive ? '#E8F8EF' : 'var(--accent-bg)',
        borderRadius: 999,
        padding: '2px 8px',
        alignSelf: 'flex-start',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {positive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  )
}
