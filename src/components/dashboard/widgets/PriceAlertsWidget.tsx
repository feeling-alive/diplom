import type { WidgetSizeProps } from '../../../types/widgets.types'

type Alert = { symbol: string; condition: '>' | '<'; price: number; current: number }
const ALERTS: Alert[] = [
  { symbol: 'BTC', condition: '>', price: 70000, current: 67420 },
  { symbol: 'ETH', condition: '<', price: 3000, current: 3210 },
  { symbol: 'SOL', condition: '>', price: 150, current: 145 },
  { symbol: 'AAPL', condition: '<', price: 180, current: 184.20 },
  { symbol: 'DOGE', condition: '>', price: 0.18, current: 0.156 },
]

type Props = WidgetSizeProps

export default function PriceAlertsWidget({ gridW = 2, gridH = 2 }: Props) {
  const limit = gridH >= 3 ? 5 : 3
  console.debug('[PriceAlertsWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {ALERTS.slice(0, limit).map((a, i) => {
          const triggered = a.condition === '>' ? a.current >= a.price : a.current <= a.price
          const color = triggered ? '#16a34a' : 'var(--muted)'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
              borderBottom: i < limit - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: triggered ? '#16a34a' : '#cbd5e1', flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{a.symbol}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color }}>{a.condition} ${a.price.toLocaleString('en-US')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
