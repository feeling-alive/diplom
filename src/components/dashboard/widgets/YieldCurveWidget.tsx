import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const DATA = [
  { tenor: '1M', yield: 5.32 },
  { tenor: '3M', yield: 5.28 },
  { tenor: '6M', yield: 5.15 },
  { tenor: '1Y', yield: 4.88 },
  { tenor: '2Y', yield: 4.62 },
  { tenor: '5Y', yield: 4.34 },
  { tenor: '10Y', yield: 4.18 },
  { tenor: '30Y', yield: 4.42 },
]

export default function YieldCurveWidget({ gridW = 3, gridH = 2 }: Props) {
  console.debug('[YieldCurveWidget] gridW=%d gridH=%d', gridW, gridH)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: 'var(--muted)' }}>US Treasuries</span>
        <span style={{ color: '#1e40af', fontWeight: 700 }}>10Y · {DATA[6].yield}%</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DATA} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="tenor" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
            <Tooltip contentStyle={{ fontSize: 11, padding: 6, borderRadius: 8 }} />
            <Line type="monotone" dataKey="yield" stroke="#1e40af" strokeWidth={2} dot={{ r: 3, fill: '#1e40af' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
