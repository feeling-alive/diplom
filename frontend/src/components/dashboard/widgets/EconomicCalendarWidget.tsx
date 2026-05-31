import type { WidgetSizeProps } from '../../../types/widgets.types'

type Event = { time: string; country: string; title: string; impact: 1 | 2 | 3 }
const EVENTS: Event[] = [
  { time: '15:30', country: 'US', title: 'NFP — Non-Farm Payrolls', impact: 3 },
  { time: '17:00', country: 'EU', title: 'CPI YoY (предв.)', impact: 3 },
  { time: '21:00', country: 'US', title: 'FOMC Statement', impact: 3 },
  { time: 'Завтра', country: 'JP', title: 'BoJ Interest Rate', impact: 2 },
  { time: 'Завтра', country: 'UK', title: 'GDP MoM', impact: 2 },
  { time: 'Чт', country: 'CN', title: 'Manufacturing PMI', impact: 1 },
]

type Props = WidgetSizeProps

export default function EconomicCalendarWidget({ gridW = 3, gridH = 2 }: Props) {
  const limit = gridH >= 3 ? 6 : 4
  console.debug('[EconomicCalendarWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {EVENTS.slice(0, limit).map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            borderBottom: i < limit - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', width: 48, flexShrink: 0 }}>{e.time}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: 'var(--bg)', color: 'var(--ink)', flexShrink: 0,
            }}>{e.country}</span>
            <span style={{ fontSize: 11, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {[1, 2, 3].map((d) => (
                <span key={d} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: d <= e.impact ? (e.impact === 3 ? '#ef4444' : e.impact === 2 ? '#f59e0b' : '#22c55e') : 'var(--border)',
                }} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
