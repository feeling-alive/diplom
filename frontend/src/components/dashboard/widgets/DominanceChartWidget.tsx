import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const SEGMENTS = [
  { label: 'BTC', value: 52, color: '#f59e0b' },
  { label: 'ETH', value: 18, color: '#6366f1' },
  { label: 'Альты', value: 30, color: '#06b6d4' },
]

export default function DominanceChartWidget({ gridW = 2, gridH = 2 }: Props) {
  const total = SEGMENTS.reduce((s, x) => s + x.value, 0)
  const showLegend = gridW >= 3 || gridH >= 3

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
      gap: 12, overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <svg width={showLegend ? '50%' : '70%'} height="100%" viewBox="0 0 42 42" style={{ maxHeight: 140 }}>
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
        <text x={21} y={22} textAnchor="middle" fontSize={6} fontWeight={800} fill="var(--ink)">{SEGMENTS[0].value}%</text>
      </svg>
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
          {SEGMENTS.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: 'var(--muted)' }}>{s.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
