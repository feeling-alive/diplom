import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function TechnicalAnalysisWidget({ gridW = 2, gridH = 2 }: Props) {
  const value = 68 // 0..100, where >60 = Buy, 40-60 = Neutral, <40 = Sell
  const label = value >= 65 ? 'Покупать' : value >= 40 ? 'Нейтрально' : 'Продавать'
  const color = value >= 65 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444'
  const angle = Math.PI - (value / 100) * Math.PI

  console.debug('[TechnicalAnalysisWidget] gridW=%d gridH=%d value=%d', gridW, gridH, value)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      boxSizing: 'border-box', overflow: 'hidden', gap: 4,
    }}>
      <svg width="100%" height="55%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 220 }}>
        <path d="M 20,90 A 60,60 0 0 1 80,30" stroke="#ef4444" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <path d="M 80,30 A 60,60 0 0 1 110,38" stroke="#f59e0b" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <path d="M 110,38 A 60,60 0 0 1 140,90" stroke="#22c55e" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <line x1={80} y1={90} x2={80 + 50 * Math.cos(angle)} y2={90 - 50 * Math.sin(angle)} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={80} cy={90} r={5} fill={color} />
      </svg>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{label}</div>
      {gridH >= 3 && (
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>MA · RSI · MACD</div>
      )}
    </div>
  )
}
