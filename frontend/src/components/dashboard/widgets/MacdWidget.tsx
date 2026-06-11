import { useState, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine, Cell } from 'recharts'
import { useOHLCV } from '../../../hooks/useOHLCV'
import type { WidgetSizeProps } from '../../../types/widgets.types'
import type { Timeframe, PricePoint } from '../../../types/market.types'

type Props = WidgetSizeProps

const ASSETS = [
  { symbol: 'BTC-USDT', label: 'BTC' },
  { symbol: 'ETH-USDT', label: 'ETH' },
  { symbol: 'SOL-USDT', label: 'SOL' }
]

const TFS: { label: string, value: Timeframe }[] = [
  { label: '30м', value: '30m' },
  { label: '1Ч', value: '1H' },
  { label: '1Д', value: '1D' },
]

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema = [data[0]]
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

function calculateMACD(points: PricePoint[]) {
  if (points.length < 26) return []
  
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const closes = sorted.map(p => p.close)
  
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  
  const macdLine = ema12.map((v, i) => v - ema26[i])
  // We need to calculate signal line (EMA9 of MACD) starting from where MACD is valid
  // But we can just pass the whole MACD array since EMA uses the first value as initial
  const signalLine = calculateEMA(macdLine, 9)
  
  // Return only the last 40 points for the chart
  const result = macdLine.map((macd, i) => {
    const signal = signalLine[i]
    return { i, macd, signal, hist: macd - signal }
  }).slice(-40)
  
  return result
}

export default function MacdWidget({ gridW = 2, gridH = 2 }: Props) {
  const [symbolIdx, setSymbolIdx] = useState(0)
  const [tfIdx, setTfIdx] = useState(0)
  
  const selected = ASSETS[symbolIdx]
  const tf = TFS[tfIdx]
  
  const { data: ohlcv, isLoading } = useOHLCV(selected.symbol, tf.value)
  const data = useMemo(() => calculateMACD(ohlcv), [ohlcv])

  const lastPoint = data[data.length - 1]

  console.debug('[MacdWidget] gridW=%d gridH=%d points=%d', gridW, gridH, data.length)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            value={symbolIdx}
            onChange={(e) => setSymbolIdx(Number(e.target.value))}
            style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 4, padding: '0 2px',
              background: 'var(--bg)', cursor: 'pointer', outline: 'none'
            }}
          >
            {ASSETS.map((a, i) => <option key={a.symbol} value={i}>{a.label}</option>)}
          </select>
          <select
            value={tfIdx}
            onChange={(e) => setTfIdx(Number(e.target.value))}
            style={{
              fontSize: 10, fontWeight: 600, color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 4, padding: '0 2px',
              background: 'var(--bg)', cursor: 'pointer', outline: 'none'
            }}
          >
            {TFS.map((t, i) => <option key={t.value} value={i}>{t.label}</option>)}
          </select>
        </div>
        {lastPoint && (
          <div style={{ display: 'flex', gap: 6, fontSize: 9, fontWeight: 600, fontFamily: 'var(--font)' }}>
            <span style={{ color: '#0ea5e9' }}>{lastPoint.macd.toFixed(2)}</span>
            <span style={{ color: '#f59e0b' }}>{lastPoint.signal.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        {isLoading && data.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>Загрузка...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="hist">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.hist >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.6} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd" stroke="#0ea5e9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
