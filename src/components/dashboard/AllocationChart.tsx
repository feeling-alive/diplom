import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { MOCK_PRICES } from '../../mock/prices.mock'

const SLICE_DATA = MOCK_PRICES.slice(0, 5).map((a) => ({
  name: a.name,
  symbol: a.symbol,
  icon: a.icon ?? a.symbol[0],
  color: a.color,
  value: a.volume24h,
}))

const total = SLICE_DATA.reduce((s, d) => s + d.value, 0)

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

interface LabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  index: number
}

function renderCustomizedLabel({ cx, cy, midAngle, innerRadius, outerRadius, index }: LabelProps) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const item = SLICE_DATA[index]
  if (!item) return null

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, fill: '#fff' }}
    >
      {item.icon}
    </text>
  )
}

export default function AllocationChart() {
  console.debug('[AllocationChart] rendered', SLICE_DATA.length, 'slices')

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Распределение</span>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={SLICE_DATA}
            cx="50%"
            cy="50%"
            outerRadius={75}
            dataKey="value"
            labelLine={false}
            label={renderCustomizedLabel as (props: unknown) => React.ReactElement | null}
          >
            {SLICE_DATA.map((entry) => (
              <Cell key={entry.symbol} fill={entry.color} stroke="var(--white)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {SLICE_DATA.map((item) => {
          const pct = (item.value / total * 100).toFixed(1)
          return (
            <div
              key={item.symbol}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>{item.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
