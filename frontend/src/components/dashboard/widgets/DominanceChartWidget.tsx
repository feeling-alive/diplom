import { useGlobalMarket } from '../../../hooks/useGlobalMarket'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function DominanceChartWidget({ gridW = 2, gridH = 2 }: Props) {
  // Доминирование берётся из общего бэкенд-прокси /api/quotes/global (useGlobalMarket),
  // как и остальные глобальные метрики — больше никаких прямых запросов в
  // api.coingecko.com из браузера (CORS/лимиты) и дублирующего localStorage-кэша
  // (Задача B1, тот же источник, что A2).
  const { data: global, isLoading } = useGlobalMarket()

  if (isLoading && !global) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }
  if (!global) return null

  const data = { btc: global.btcDominance, eth: global.ethDominance, change24h: global.marketCapChange24h }
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
