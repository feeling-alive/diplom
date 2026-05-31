import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function GlobalMarketCapWidget({ gridW = 2, gridH = 1 }: Props) {
  const value = 2.43 // trillion USD
  const change = 1.8
  const positive = change >= 0
  console.debug('[GlobalMarketCapWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', gap: 12,
      overflow: 'hidden',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Капитал крипторынка</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
          ${value.toFixed(2)}T
        </div>
      </div>
      <div style={{
        padding: '3px 8px', borderRadius: 999,
        background: positive ? '#dcfce7' : '#fee2e2',
        color: positive ? '#16a34a' : '#dc2626',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>
        {positive ? '+' : ''}{change.toFixed(1)}%
      </div>
    </div>
  )
}
