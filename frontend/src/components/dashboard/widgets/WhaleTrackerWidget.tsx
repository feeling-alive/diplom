import type { WidgetSizeProps } from '../../../types/widgets.types'

type Tx = { symbol: string; amount: string; usd: string; ago: string; kind: 'in' | 'out' }
const TXS: Tx[] = [
  { symbol: 'BTC', amount: '1 240', usd: '83.6M', ago: '4м', kind: 'out' },
  { symbol: 'ETH', amount: '8 500', usd: '27.3M', ago: '12м', kind: 'in' },
  { symbol: 'USDT', amount: '50M', usd: '50.0M', ago: '24м', kind: 'in' },
  { symbol: 'SOL', amount: '180k', usd: '26.1M', ago: '38м', kind: 'out' },
  { symbol: 'BTC', amount: '450', usd: '30.3M', ago: '52м', kind: 'in' },
]

type Props = WidgetSizeProps

export default function WhaleTrackerWidget({ gridW = 2, gridH = 2 }: Props) {
  const limit = gridH >= 3 ? 5 : 3
  console.info('[WhaleTrackerWidget] gridW=%d gridH=%d demo data (no free public whale-alert API)', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <span style={{
        position: 'absolute', top: 0, right: 0, zIndex: 1,
        fontSize: 8, fontWeight: 700, color: 'var(--muted)',
        background: 'var(--bg)', borderRadius: 4, padding: '1px 5px',
      }}>Demo</span>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {TXS.slice(0, limit).map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0',
            borderBottom: i < limit - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              background: t.kind === 'in' ? '#dcfce7' : '#fee2e2',
              color: t.kind === 'in' ? '#16a34a' : '#dc2626',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, flexShrink: 0,
            }}>{t.kind === 'in' ? '↓' : '↑'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', minWidth: 32 }}>{t.symbol}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.amount}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>${t.usd}</span>
            <span style={{ fontSize: 9, color: 'var(--muted)', width: 24, textAlign: 'right' }}>{t.ago}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
