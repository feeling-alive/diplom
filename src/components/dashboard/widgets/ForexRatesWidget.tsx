import { useForexRate } from '../../../hooks/useForexRate'

const PAIRS = [
  { from: 'EUR', to: 'USD', label: 'EUR/USD' },
  { from: 'GBP', to: 'USD', label: 'GBP/USD' },
  { from: 'USD', to: 'JPY', label: 'USD/JPY' },
  { from: 'USD', to: 'CHF', label: 'USD/CHF' },
]

export default function ForexRatesWidget() {
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 12, display: 'block' }}>
        Форекс курсы
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PAIRS.map((pair) => (
          <ForexRow key={pair.label} from={pair.from} to={pair.to} label={pair.label} />
        ))}
      </div>
    </div>
  )
}

function ForexRow({ from, to, label }: { from: string; to: string; label: string }) {
  const { rate, isLoading } = useForexRate(from, to)

  // Mock change values for demo
  const changes: Record<string, number> = {
    'EUR/USD': 0.3,
    'GBP/USD': -0.2,
    'USD/JPY': 0.15,
    'USD/CHF': -0.05,
  }
  const change = changes[label] ?? 0
  const isPositive = change >= 0

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
          {isLoading ? '...' : rate.toFixed(4)}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isPositive ? 'var(--green)' : 'var(--accent)',
        }}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}