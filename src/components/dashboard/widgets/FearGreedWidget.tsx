import { useMemo } from 'react'

export default function FearGreedWidget() {
  // Mock value
  const index = 72
  const label = index >= 75 ? 'Greed' : index >= 50 ? 'Neutral' : index >= 25 ? 'Fear' : 'Extreme Fear'
  const color = index >= 75 ? '#22c55e' : index >= 50 ? '#f59e0b' : index >= 25 ? '#f97316' : '#ef4444'

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

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
        Страх и жадность
      </span>
      <svg width="160" height="90" viewBox="0 0 160 90" style={{ overflow: 'visible' }}>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={`M 80,90 L ${80 + 70 * Math.cos(seg.startAngle)},${90 + 70 * Math.sin(seg.startAngle)} A 70,70 0 0,1 ${80 + 70 * Math.cos(seg.endAngle)},${90 + 70 * Math.sin(seg.endAngle)} Z`}
            fill={seg.color}
            opacity={0.25}
            stroke="none"
          />
        ))}
        {/* Needle */}
        <line
          x1={80}
          y1={90}
          x2={80 + 55 * Math.cos(Math.PI + ((100 - index) / 100) * Math.PI)}
          y2={90 + 55 * Math.sin(Math.PI + ((100 - index) / 100) * Math.PI)}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={80} cy={90} r={4} fill={color} />
      </svg>
      <span style={{ fontSize: 36, fontWeight: 800, color, marginTop: 4 }}>{index}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}