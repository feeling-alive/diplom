import { useMemo } from 'react'
import { useFearGreed, fngColor as getColor } from '../../../hooks/useFearGreed'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function FearGreedWidget({ gridW = 1, gridH = 2 }: Props) {
  const { data: effective, isLoading } = useFearGreed()
  const showLoading = isLoading && !effective

  const segments = useMemo(() => {
    const result: { color: string; startAngle: number; endAngle: number }[] = []
    const startAngle = Math.PI
    const totalAngle = Math.PI
    const step = totalAngle / 100

    for (let i = 0; i < 100; i++) {
      const pct = i / 100
      let segColor: string
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

  if (showLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>
        Загрузка…
      </div>
    )
  }

  const value = effective?.value ?? 0
  const label = effective?.label ?? '—'
  const color = getColor(value)
  const updatedAt = effective ? new Date(effective.timestamp * 1000).toLocaleDateString() : ''

  const showGauge = gridW >= 2 || gridH >= 2
  const showLabel = gridH >= 2

  console.debug('[FearGreedWidget] gridW=%d gridH=%d value=%d gauge=%s label=%s', gridW, gridH, value, showGauge, showLabel)

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
