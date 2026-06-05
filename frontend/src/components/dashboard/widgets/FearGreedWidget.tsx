import { useState, useEffect, useMemo } from 'react'
import { ENV, USE_MOCK } from '../../../lib/env'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

interface FngData {
  value: number
  label: string
  timestamp: number
}

function getLabel(value: number): string {
  if (value >= 75) return 'Жадность'
  if (value >= 50) return 'Нейтрально'
  if (value >= 25) return 'Страх'
  return 'Крайний страх'
}

function getColor(value: number): string {
  if (value >= 75) return '#22c55e'
  if (value >= 50) return '#f97316'
  if (value >= 25) return '#f59e0b'
  return '#ef4444'
}

const CACHE_KEY = 'fintrack_fng_cache_v1'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CacheEntry { value: number; label: string; timestamp: number; cachedAt: number }
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

function writeCache(value: number, label: string, timestamp: number) {
  try {
    const entry: CacheEntry = { value, label, timestamp, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    /* localStorage full / disabled */
  }
}

export default function FearGreedWidget({ gridW = 1, gridH = 2 }: Props) {
  const [data, setData] = useState<FngData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      console.info('[FearGreedWidget] cache hit — value=%d label=%s', cached.value, cached.label)
      setData({ value: cached.value, label: cached.label, timestamp: cached.timestamp })
      setIsLoading(false)
      return
    }

    if (USE_MOCK) {
      console.info('[FearGreedWidget] using mock data')
      setData({ value: 72, label: getLabel(72), timestamp: Date.now() / 1000 })
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchFn = async () => {
      try {
        console.info('[FearGreedWidget] fetching /api/fng/ from alternative.me')
        const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: controller.signal })
        if (!res.ok) throw new Error(`FNG ${res.status}`)
        const json = (await res.json()) as { data: Array<{ value: string; value_classification: string; timestamp: string }> }
        const first = json.data[0]
        if (!first) throw new Error('Empty FNG response')
        const value = parseInt(first.value, 10)
        const label = getLabel(value)
        const timestamp = parseInt(first.timestamp, 10)
        setData({ value, label, timestamp })
        writeCache(value, label, timestamp)
        console.info('[FearGreedWidget] fetched — value=%d label=%s ts=%d', value, label, timestamp)
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('[FearGreedWidget] fetch failed, using fallback:', err)
        setData({ value: 50, label: 'Нейтрально', timestamp: Date.now() / 1000 })
      } finally {
        setIsLoading(false)
      }
    }
    fetchFn()

    return () => controller.abort()
  }, [])

  const value = data?.value ?? 0
  const label = data?.label ?? '—'
  const color = getColor(value)
  const updatedAt = data ? new Date(data.timestamp * 1000).toLocaleDateString() : ''

  const showGauge = gridW >= 2 || gridH >= 2
  const showLabel = gridH >= 2

  console.debug('[FearGreedWidget] gridW=%d gridH=%d value=%d gauge=%s label=%s', gridW, gridH, value, showGauge, showLabel)

  const segments = useMemo(() => {
    const result: { color: string; startAngle: number; endAngle: number }[] = []
    const startAngle = Math.PI
    const totalAngle = Math.PI
    const step = totalAngle / 100

    for (let i = 0; i < 100; i++) {
      const pct = i / 100
      let segColor = '#22c55e'
      if (pct > 0.75) segColor = '#22c55e'
      else if (pct > 0.5) segColor = '#f59e0b'
      else if (pct > 0.25) segColor = '#f97316'
      else segColor = '#ef4444'

      result.push({
        color: segColor,
        startAngle: startAngle + i * step,
        endAngle: startAngle + (i + 1) * step,
      })
    }
    return result
  }, [])

  if (isLoading && !data) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }

  if (!showGauge) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 800,
        }}>
          {value}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" style={{ flex: 1, minHeight: 0 }}>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={`M 80,90 L ${80 + 70 * Math.cos(seg.startAngle)},${90 + 70 * Math.sin(seg.startAngle)} A 70,70 0 0,1 ${80 + 70 * Math.cos(seg.endAngle)},${90 + 70 * Math.sin(seg.endAngle)} Z`}
            fill={seg.color}
            opacity={0.25}
            stroke="none"
          />
        ))}
        <line
          x1={80}
          y1={90}
          x2={80 + 55 * Math.cos(Math.PI + ((100 - value) / 100) * Math.PI)}
          y2={90 + 55 * Math.sin(Math.PI + ((100 - value) / 100) * Math.PI)}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={80} cy={90} r={4} fill={color} />
        <text x={80} y={88} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: color }}>
          {value}
        </text>
      </svg>
      {showLabel && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: -4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
          {updatedAt && (
            <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 500 }}>{updatedAt}</span>
          )}
        </div>
      )}
    </div>
  )
}
