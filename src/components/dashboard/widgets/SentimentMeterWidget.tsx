import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function SentimentMeterWidget({ gridW = 2, gridH = 2 }: Props) {
  const score = 62 // 0..100, >50 bullish
  const label = score >= 65 ? 'Bullish' : score >= 35 ? 'Neutral' : 'Bearish'
  const color = score >= 65 ? '#16a34a' : score >= 35 ? '#f59e0b' : '#ef4444'
  console.debug('[SentimentMeterWidget] gridW=%d gridH=%d score=%d', gridW, gridH, score)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, overflow: 'hidden',
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{score}</div>
      <div style={{
        width: '85%', height: 8, borderRadius: 999, overflow: 'hidden',
        background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #16a34a 100%)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -3, left: `calc(${score}% - 4px)`,
          width: 8, height: 14, borderRadius: 4, background: 'var(--ink)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
      {gridH >= 3 && (
        <div style={{ fontSize: 9, color: 'var(--muted)' }}>соцсети + новости</div>
      )}
    </div>
  )
}
