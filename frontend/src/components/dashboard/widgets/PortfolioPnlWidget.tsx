import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const DATA = [
  { label: '24ч', value: 423.50, pct: 2.8 },
  { label: '7д', value: -128.20, pct: -0.9 },
  { label: '30д', value: 2840.00, pct: 18.4 },
]

export default function PortfolioPnlWidget({ gridW = 3, gridH = 1 }: Props) {
  const items = gridW >= 4 ? DATA : gridW >= 3 ? DATA : DATA.slice(0, 1)
  console.debug('[PortfolioPnlWidget] gridW=%d gridH=%d items=%d', gridW, gridH, items.length)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      gap: 8, overflow: 'hidden',
    }}>
      {items.map((d) => {
        const positive = d.value >= 0
        const color = positive ? '#16a34a' : '#ef4444'
        return (
          <div key={d.label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flex: 1, minWidth: 0,
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{d.label}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color }}>
              {positive ? '+' : ''}{d.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} $
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color }}>
              {positive ? '+' : ''}{d.pct.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
