import { useState, useEffect, useRef } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { price: number; size: number }

const PAIRS = [
  { label: 'BTC', instId: 'BTC-USDT' },
  { label: 'ETH', instId: 'ETH-USDT' },
  { label: 'SOL', instId: 'SOL-USDT' },
]

type Props = WidgetSizeProps

export default function OrderBookWidget({ gridW = 2, gridH = 2 }: Props) {
  const [pairIdx, setPairIdx] = useState(0)
  const [asks, setAsks] = useState<Row[]>([])
  const [bids, setBids] = useState<Row[]>([])
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'unsupported'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)

  const pair = PAIRS[pairIdx]
  const limit = gridH >= 3 ? 5 : 4

  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      console.warn('[OrderBookWidget] WebSocket unsupported in this environment')
      setStatus('unsupported')
      return
    }
    setStatus('connecting')
    setAsks([])
    setBids([])

    let cancelled = false
    const url = 'wss://ws.okx.com:8443/ws/v5/public'
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (cancelled) return
      console.debug('[OrderBookWidget] WS open, subscribing to books5 %s', pair.instId)
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'books5', instId: pair.instId }] }))
      setStatus('open')
    }
    ws.onmessage = (e) => {
      if (cancelled) return
      try {
        const msg = JSON.parse(e.data) as { arg?: { channel: string; instId: string }; data?: Array<{ asks: string[][]; bids: string[][] }> }
        if (msg.arg?.channel === 'books5' && msg.data?.[0]) {
          const next = msg.data[0]
          setAsks(next.asks.slice(0, 5).map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) })))
          setBids(next.bids.slice(0, 5).map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) })))
        }
      } catch (err) {
        console.warn('[OrderBookWidget] failed to parse WS message', err)
      }
    }
    ws.onerror = () => {
      if (cancelled) return
      console.warn('[OrderBookWidget] WS error, falling back to hidden state')
      setStatus('closed')
    }
    ws.onclose = () => {
      if (cancelled) return
      console.debug('[OrderBookWidget] WS closed')
      setStatus((s) => (s === 'open' ? 'closed' : s))
    }

    return () => {
      cancelled = true
      try { ws.close() } catch { /* ignore */ }
      wsRef.current = null
    }
  }, [pair.instId])

  console.debug('[OrderBookWidget] gridW=%d gridH=%d pair=%s status=%s', gridW, gridH, pair.label, status)

  if (status === 'unsupported' || (status === 'closed' && asks.length === 0 && bids.length === 0)) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11, padding: 8, textAlign: 'center' }}>
        Книга ордеров недоступна
      </div>
    )
  }

  const allRows = [...asks, ...bids]
  const maxSize = allRows.reduce((m, r) => Math.max(m, r.size), 0) || 1
  const midPrice = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : 0

  const renderRow = (r: Row, side: 'ask' | 'bid') => {
    const pct = (r.size / maxSize) * 100
    const color = side === 'ask' ? '#ef4444' : '#16a34a'
    return (
      <div key={`${side}-${r.price}`} style={{
        position: 'relative', display: 'flex', justifyContent: 'space-between',
        padding: '2px 4px', fontSize: 10, fontVariantNumeric: 'tabular-nums',
      }}>
        <div style={{
          position: 'absolute', top: 0,
          ...(side === 'ask' ? { right: 0 } : { left: 0 }),
          height: '100%', width: `${pct}%`,
          background: color, opacity: 0.12,
        }} />
        <span style={{ position: 'relative', color, fontWeight: 600 }}>{r.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        <span style={{ position: 'relative', color: 'var(--text)' }}>{r.size.toFixed(3)}</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 4, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
        <select
          value={pairIdx}
          onChange={(e) => setPairIdx(Number(e.target.value))}
          style={{ fontSize: 10, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 4, padding: '0 2px', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none' }}
        >
          {PAIRS.map((p, i) => <option key={p.instId} value={i}>{p.label}</option>)}
        </select>
        <span style={{ fontSize: 9, color: status === 'open' ? 'var(--green)' : 'var(--muted)', fontWeight: 600 }}>● {status === 'open' ? 'live' : status}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {asks.slice(0, limit).reverse().map((r) => renderRow(r, 'ask'))}
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--ink)',
          textAlign: 'center', padding: '3px 0',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          fontVariantNumeric: 'tabular-nums',
        }}>{midPrice > 0 ? midPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</div>
        {bids.slice(0, limit).map((r) => renderRow(r, 'bid'))}
      </div>
    </div>
  )
}
