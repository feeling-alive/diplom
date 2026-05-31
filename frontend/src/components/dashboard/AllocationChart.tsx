import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { MOCK_PRICES } from '../../mock/prices.mock'
import type { WidgetSizeProps } from '../../types/widgets.types'

const SLICE_DATA = MOCK_PRICES.slice(0, 5).map((a) => ({
  name: a.name,
  symbol: a.symbol,
  icon: a.icon ?? a.symbol[0],
  color: a.color,
  value: a.volume24h,
}))

const total = SLICE_DATA.reduce((s, d) => s + d.value, 0) || 1

interface TooltipEntry { name?: string; value?: number }
interface CustomTooltipProps { active?: boolean; payload?: TooltipEntry[] }

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = ((item?.value ?? 0) / total * 100).toFixed(1)
  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '6px 10px',
        boxShadow: 'var(--shadow-sm)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
      <div style={{ color: 'var(--muted)' }}>{pct}%</div>
    </div>
  )
}

// Превращаем цвет сектора в светлый стоп — простая трансформация для градиентной заливки
function lighten(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

type Props = WidgetSizeProps

export default function AllocationChart({ gridW = 2, gridH = 2 }: Props) {
  const showLegend = gridH >= 3

  console.debug('[AllocationChart] gridW=%d gridH=%d slices=%d legend=%s', gridW, gridH, SLICE_DATA.length, showLegend)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {SLICE_DATA.map((entry) => (
                <linearGradient
                  key={`grad-${entry.symbol}`}
                  id={`alloc-grad-${entry.symbol}`}
                  x1="0" y1="0" x2="1" y2="1"
                >
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={lighten(entry.color, 0.6)} stopOpacity={0.9} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={SLICE_DATA}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              dataKey="value"
              paddingAngle={2}
              isAnimationActive
              animationDuration={600}
              animationBegin={0}
            >
              {SLICE_DATA.map((entry) => (
                <Cell
                  key={entry.symbol}
                  fill={`url(#alloc-grad-${entry.symbol})`}
                  stroke="var(--white)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, flexShrink: 0 }}>
          {SLICE_DATA.map((item) => {
            const pct = (item.value / total * 100).toFixed(1)
            const symbolShort = item.symbol.split('-')[0]
            return (
              <div key={item.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {symbolShort}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
