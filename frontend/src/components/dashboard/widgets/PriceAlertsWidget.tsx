import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Condition = '>' | '<'
type Alert = { id: string; symbol: string; condition: Condition; price: number; triggered: boolean }

const STORAGE_KEY = 'fintrack_price_alerts_v1'

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Alert[]
  } catch { return [] }
}

function saveAlerts(alerts: Alert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)) } catch { /* ignore */ }
}

async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function sendNotification(alert: Alert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification(`FinTrack: ${alert.symbol}`, {
    body: `${alert.symbol} ${alert.condition === '>' ? 'выше' : 'ниже'} $${alert.price.toLocaleString('en-US')}`,
    icon: '/favicon.ico',
  })
}

function genId() { return 'a_' + Math.random().toString(36).slice(2, 10) }

type Props = WidgetSizeProps

export default function PriceAlertsWidget({ gridW = 2, gridH = 2 }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<{ symbol: string; condition: Condition; price: string }>({ symbol: 'BTC-USDT', condition: '>', price: '' })
  const { all } = usePrices()
  const triggeredIdsRef = useRef<Set<string>>(new Set())
  const [permGranted, setPermGranted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermGranted(Notification.permission === 'granted')
    }
  }, [])

  // Persist
  useEffect(() => { saveAlerts(alerts) }, [alerts])

  // Check alerts on price update
  useEffect(() => {
    if (all.length === 0) return
    const priceMap = new Map(all.map(a => [a.symbol, a.price]))
    let hasChanges = false
    const updated = alerts.map(a => {
      const current = priceMap.get(a.symbol)
      if (current === undefined) return a
      const reached = a.condition === '>' ? current >= a.price : current <= a.price
      if (reached && !a.triggered && !triggeredIdsRef.current.has(a.id)) {
        console.info('[PriceAlertsWidget] alert triggered — %s %s %s', a.symbol, a.condition, a.price)
        triggeredIdsRef.current.add(a.id)
        sendNotification(a)
        hasChanges = true
        return { ...a, triggered: true }
      }
      return a
    })
    if (hasChanges) setAlerts(updated)
  }, [all, alerts])

  const handleAdd = useCallback(() => {
    const price = parseFloat(form.price)
    if (!Number.isFinite(price) || price <= 0) {
      console.warn('[PriceAlertsWidget] invalid price:', form.price)
      return
    }
    const newAlert: Alert = {
      id: genId(),
      symbol: form.symbol,
      condition: form.condition,
      price,
      triggered: false,
    }
    setAlerts(prev => [...prev, newAlert])
    setForm({ symbol: 'BTC-USDT', condition: '>', price: '' })
    setAdding(false)
    console.debug('[PriceAlertsWidget] added — %s %s %s', newAlert.symbol, newAlert.condition, newAlert.price)
  }, [form])

  const handleRemove = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    triggeredIdsRef.current.delete(id)
    console.debug('[PriceAlertsWidget] removed alert %s', id)
  }, [])

  const handleEnableNotifications = useCallback(async () => {
    const ok = await requestNotificationPermission()
    setPermGranted(ok)
    if (ok) console.info('[PriceAlertsWidget] notifications enabled')
    else console.warn('[PriceAlertsWidget] notifications denied or unsupported')
  }, [])

  const limit = gridH >= 3 ? 6 : 4
  const visible = alerts.slice(0, limit)
  const priceMap = useMemo(() => new Map(all.map(a => [a.symbol, a.price])), [all])

  console.debug('[PriceAlertsWidget] gridW=%d gridH=%d alerts=%d', gridW, gridH, alerts.length)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 4, boxSizing: 'border-box' }}>
      {!permGranted && alerts.length > 0 && (
        <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4, flexShrink: 0, cursor: 'pointer' }} onClick={handleEnableNotifications}>
          Включить уведомления →
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflow: 'auto' }}>
          <select
            value={form.symbol}
            onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))}
            style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)' }}
          >
            {all.slice(0, 12).map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setForm(f => ({ ...f, condition: '>' }))} style={{ flex: 1, padding: 2, fontSize: 11, fontWeight: 700, background: form.condition === '>' ? 'var(--green)' : 'var(--bg)', color: form.condition === '>' ? '#fff' : 'var(--text)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>↑</button>
            <button onClick={() => setForm(f => ({ ...f, condition: '<' }))} style={{ flex: 1, padding: 2, fontSize: 11, fontWeight: 700, background: form.condition === '<' ? 'var(--accent)' : 'var(--bg)', color: form.condition === '<' ? '#fff' : 'var(--text)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>↓</button>
          </div>
          <input
            type="number"
            placeholder="Цена"
            value={form.price}
            onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
            style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: 3, fontSize: 10, fontWeight: 700, background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>OK</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 3, fontSize: 10, fontWeight: 600, background: 'var(--bg)', color: 'var(--muted)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>×</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
            {alerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 11 }}>Нет уведомлений</div>
            ) : visible.map((a) => {
              const current = priceMap.get(a.symbol)
              const color = a.triggered ? '#16a34a' : '#cbd5e1'
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.triggered ? 'var(--muted)' : 'var(--text)', textDecoration: a.triggered ? 'line-through' : 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.symbol.split('-')[0]} {a.condition} ${a.price.toLocaleString('en-US')}
                  </span>
                  {current !== undefined && (
                    <span style={{ fontSize: 9, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>${current.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  )}
                  <button
                    onClick={() => handleRemove(a.id)}
                    style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    aria-label="Удалить"
                  >×</button>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setAdding(true)}
            style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left', flexShrink: 0 }}
          >+ Добавить</button>
        </>
      )}
    </div>
  )
}
