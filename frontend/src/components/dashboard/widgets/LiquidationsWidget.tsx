import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

function genBars() {
  const data = []
  for (let i = 0; i < 24; i++) {
    data.push({
      i,
      longs: -(Math.random() * 8 + 2),
      shorts: Math.random() * 10 + 1,
    })
  }
  return data
}

export default function LiquidationsWidget({ gridW = 2, gridH = 2 }: Props) {
  const data = useMemo(genBars, [])
  const totalLongs = Math.abs(data.reduce((s, d) => s + d.longs, 0)).toFixed(0)
  const totalShorts = data.reduce((s, d) => s + d.shorts, 0).toFixed(0)
  console.debug('[LiquidationsWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>Longs ${totalLongs}M</span>
        <span style={{ color: '#16a34a', fontWeight: 700 }}>Shorts ${totalShorts}M</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }} stackOffset="sign">
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="longs" fill="#ef4444" />
            <Bar dataKey="shorts" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
