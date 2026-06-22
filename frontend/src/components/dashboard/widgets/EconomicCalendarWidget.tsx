import { useState, useEffect } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'
import { ENV, USE_MOCK } from '../../../lib/env'

type Event = { time: string; country: string; title: string; impact: 1 | 2 | 3 }

type Props = WidgetSizeProps

export default function EconomicCalendarWidget({ gridW = 3, gridH = 2 }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const fetchFn = async () => {
      try {
        if (USE_MOCK) throw new Error('mock mode')
        const from = new Date().toISOString().split('T')[0]
        const to = new Date(Date.now() + 7 * 86400 * 1000).toISOString().split('T')[0]
        console.info('[EconomicCalendarWidget] fetching Finnhub /calendar/economic %s..%s', from, to)
        const res = await fetch(`${ENV.FINNHUB_BASE_URL}/calendar/economic?from=${from}&to=${to}&token=${ENV.FINNHUB_API_KEY}`, { signal: controller.signal })
        if (!res.ok) throw new Error(`Finnhub ${res.status}`)
        const json = (await res.json()) as { economicCalendar: Array<{ time: string; country: string; event: string; impact: string }> }
        const mapped: Event[] = (json.economicCalendar ?? []).map((e) => ({
          time: e.time,
          country: e.country,
          title: e.event,
          impact: e.impact === 'high' ? 3 : e.impact === 'medium' ? 2 : 1,
        }))
        setEvents(mapped)
        console.info('[EconomicCalendarWidget] fetched %d events', mapped.length)
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('[EconomicCalendarWidget] API failed, using mock:', err)
        setEvents([
          { time: '15:30', country: 'US', title: 'NFP — Non-Farm Payrolls', impact: 3 },
          { time: '17:00', country: 'EU', title: 'CPI YoY (предв.)', impact: 3 },
          { time: '21:00', country: 'US', title: 'FOMC Statement', impact: 3 },
          { time: 'Завтра', country: 'JP', title: 'BoJ Interest Rate', impact: 2 },
          { time: 'Завтра', country: 'UK', title: 'GDP MoM', impact: 2 },
          { time: 'Чт', country: 'CN', title: 'Manufacturing PMI', impact: 1 },
        ])
      } finally {
        setIsLoading(false)
      }
    }
    fetchFn()
    return () => controller.abort()
  }, [])

  const limit = gridH >= 3 ? 6 : gridH >= 2 ? 5 : 4
  console.debug('[EconomicCalendarWidget] gridW=%d gridH=%d events=%d', gridW, gridH, events.length)

  if (isLoading) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
        {events.slice(0, limit).map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
            borderBottom: i < limit - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', width: 48, flexShrink: 0 }}>{e.time}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: 'var(--bg)', color: 'var(--ink)', flexShrink: 0,
            }}>{e.country}</span>
            <span
              aria-label={e.title}
              style={{ fontSize: 11, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >{e.title}</span>
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }} aria-label={`Impact: ${e.impact}/3`}>
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
