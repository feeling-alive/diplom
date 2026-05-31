import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine } from 'recharts'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

function genSeries() {
  const data = []
  for (let i = 0; i < 40; i++) {
    const macd = Math.sin(i / 5) * 4 + Math.sin(i / 11) * 2
    const signal = Math.sin((i - 2) / 5) * 4 + Math.sin((i - 2) / 11) * 2
    data.push({ i, macd, signal, hist: macd - signal })
  }
  return data
}

export default function MacdWidget({ gridW = 2, gridH = 2 }: Props) {
  const data = useMemo(genSeries, [])
  console.debug('[MacdWidget] gridW=%d gridH=%d points=%d', gridW, gridH, data.length)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: 'var(--muted)' }}>MACD</span>
        <span style={{ color: '#0284c7', fontWeight: 600 }}>BTC · 1H</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="hist" fill="#0284c7" fillOpacity={0.5} />
            <Line type="monotone" dataKey="macd" stroke="#0284c7" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
