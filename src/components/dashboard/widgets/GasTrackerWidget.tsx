import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const TIERS = [
  { label: 'Slow', gwei: 18, color: '#22c55e' },
  { label: 'Std', gwei: 24, color: '#f59e0b' },
  { label: 'Fast', gwei: 32, color: '#ef4444' },
]

export default function GasTrackerWidget({ gridW = 2, gridH = 1 }: Props) {
  console.debug('[GasTrackerWidget] gridW=%d gridH=%d', gridW, gridH)
  const compact = gridW < 2 && gridH < 2
  if (compact) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{TIERS[1].gwei}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>gwei · ETH</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      gap: 6, overflow: 'hidden',
    }}>
      {TIERS.map((t) => (
        <div key={t.label} style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.label}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: t.color }}>{t.gwei}</span>
          <span style={{ fontSize: 8, color: 'var(--muted)' }}>gwei</span>
        </div>
      ))}
    </div>
  )
}
