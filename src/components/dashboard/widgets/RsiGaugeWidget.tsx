import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function RsiGaugeWidget({ gridW = 1, gridH = 2 }: Props) {
  const rsi = 62
  const zone = rsi >= 70 ? 'Перекупл.' : rsi >= 30 ? 'Нейтрально' : 'Перепрод.'
  const color = rsi >= 70 ? '#ef4444' : rsi >= 30 ? '#0ea5e9' : '#22c55e'
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const dash = (rsi / 100) * circumference

  console.debug('[RsiGaugeWidget] gridW=%d gridH=%d rsi=%d', gridW, gridH, rsi)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: gridW >= 2 ? 'row' : 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 6, overflow: 'hidden',
    }}>
      <svg width={64} height={64} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={radius} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle
          cx={40} cy={40} r={radius} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x={40} y={45} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--ink)">{rsi}</text>
      </svg>
      {gridH >= 2 && (
        <div style={{ textAlign: gridW >= 2 ? 'left' : 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>RSI 14</div>
          <div style={{ fontSize: 11, fontWeight: 700, color }}>{zone}</div>
        </div>
      )}
    </div>
  )
}
