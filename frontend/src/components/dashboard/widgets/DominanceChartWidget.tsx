import { useState, useEffect } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const CACHE_KEY = 'fintrack_dominance_v1'
const CACHE_TTL_MS = 5 * 60 * 1000

interface DomData {
  btc: number
  eth: number
  change24h: number
}

interface CacheEntry extends DomData { cachedAt: number }
function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function writeCache(data: DomData) {
  try {
    const entry = { ...data, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch { /* ignore */ }
}

export default function DominanceChartWidget({ gridW = 2, gridH = 2 }: Props) {
  const [data, setData] = useState<DomData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      console.info('[DominanceChartWidget] cache hit — btc=%.2f%% eth=%.2f%%', cached.btc, cached.eth)
      setData(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchFn = async () => {
      try {
        console.info('[DominanceChartWidget] fetching CoinGecko /global')
        const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: controller.signal })
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
        const json = (await res.json()) as {
          data: { market_cap_percentage: { btc: number; eth: number }; market_cap_change_percentage_24h_usd: number }
        }
        const next: DomData = {
          btc: json.data.market_cap_percentage.btc,
          eth: json.data.market_cap_percentage.eth,
          change24h: json.data.market_cap_change_percentage_24h_usd,
        }
        setData(next)
        writeCache(next)
        console.info('[DominanceChartWidget] fetched btc=%.2f%% eth=%.2f%%', next.btc, next.eth)
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('[DominanceChartWidget] fetch failed, using fallback:', err)
        setData({ btc: 52.4, eth: 17.2, change24h: 1.8 })
      } finally {
        setIsLoading(false)
      }
    }
    fetchFn()
    return () => controller.abort()
  }, [])

  if (isLoading && !data) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }
  if (!data) return null

  const btc = data.btc
  const eth = data.eth
  const others = 100 - btc - eth
  const SEGMENTS = [
    { label: 'BTC', value: btc, color: '#f59e0b' },
    { label: 'ETH', value: eth, color: '#6366f1' },
    { label: 'Альты', value: others, color: '#06b6d4' },
  ]

  const total = SEGMENTS.reduce((s, x) => s + x.value, 0)
  const showLegend = true
  const positive = data.change24h >= 0

  let offset = 0
  const arcs = SEGMENTS.map((s) => {
    const len = (s.value / total) * 100
    const a = { ...s, offset, length: len }
    offset += len
    return a
  })
  console.debug('[DominanceChartWidget] gridW=%d gridH=%d legend=%s', gridW, gridH, showLegend)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, overflow: 'hidden', boxSizing: 'border-box',
      padding: 4,
    }}>
      <div style={{ position: 'relative', width: showLegend ? 70 : 90, height: '100%', display: 'flex', alignItems: 'center' }}>
        <svg width="100%" height="100%" viewBox="0 0 42 42" style={{ maxHeight: 100 }}>
          <circle cx={21} cy={21} r={15.915} fill="var(--white)" stroke="var(--border)" strokeWidth={3} />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={21} cy={21} r={15.915} fill="transparent"
              stroke={a.color} strokeWidth={5}
              strokeDasharray={`${a.length} ${100 - a.length}`}
              strokeDashoffset={100 - a.offset + 25}
            />
          ))}
          <text x={21} y={22} textAnchor="middle" fontSize={6} fontWeight={800} fill="var(--ink)">{btc.toFixed(1)}%</text>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, flex: 1, minWidth: 0 }}>
        {SEGMENTS.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 10 }}>{s.label}</span>
            </div>
            <span style={{ color: 'var(--muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.value.toFixed(1)}%</span>
          </div>
        ))}
        <div style={{ fontSize: 9, color: positive ? 'var(--green)' : 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
          24ч: {positive ? '+' : ''}{data.change24h.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}
