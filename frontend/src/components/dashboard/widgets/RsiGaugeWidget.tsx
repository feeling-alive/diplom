import { useState, useMemo } from 'react'
import { useOHLCV } from '../../../hooks/useOHLCV'
import type { WidgetSizeProps } from '../../../types/widgets.types'
import type { PricePoint } from '../../../types/market.types'

type Props = WidgetSizeProps

const ASSETS = [
  { symbol: 'BTC-USDT', label: 'BTC' },
  { symbol: 'ETH-USDT', label: 'ETH' },
  { symbol: 'SOL-USDT', label: 'SOL' }
]

function calculateRSI(data: PricePoint[], period = 14): { rsi: number; prevRsi: number } | null {
  if (data.length <= period) return null
  
  // Sort data ascending (oldest first)
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  
  let gains = 0
  let losses = 0
  
  for (let i = 1; i <= period; i++) {
    const change = sorted[i].close - sorted[i - 1].close
    if (change > 0) gains += change
    else losses -= change
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // First RSI
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  let rsi = 100 - (100 / (1 + rs))
  let prevRsi = rsi
  
  // Smoothed Moving Average for the rest
  for (let i = period + 1; i < sorted.length; i++) {
    const change = sorted[i].close - sorted[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    
    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period
    
    prevRsi = rsi
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi = 100 - (100 / (1 + rs))
  }
  
  return { rsi: Math.round(rsi), prevRsi: Math.round(prevRsi) }
}

export default function RsiGaugeWidget({ gridW = 1, gridH = 2 }: Props) {
  const [symbolIdx, setSymbolIdx] = useState(0)
  const selected = ASSETS[symbolIdx]
  
  const { data, isLoading } = useOHLCV(selected.symbol, '1D')
  
  const rsiData = useMemo(() => calculateRSI(data), [data])
  const rsi = rsiData?.rsi ?? 50
  const prevRsi = rsiData?.prevRsi ?? 50
  
  const zone = rsi >= 70 ? 'Перекупл.' : rsi <= 30 ? 'Перепрод.' : 'Нейтрально'
  const color = rsi >= 70 ? '#22c55e' : rsi <= 30 ? '#ef4444' : '#94a3b8'
  
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (rsi / 100) * circumference

  console.debug('[RsiGaugeWidget] gridW=%d gridH=%d symbol=%s rsi=%o', gridW, gridH, selected.symbol, rsiData)

  if (isLoading && data.length === 0) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка...</div>
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <select
          value={symbolIdx}
          onChange={(e) => setSymbolIdx(Number(e.target.value))}
          style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px',
            background: 'var(--bg)', cursor: 'pointer'
          }}
        >
          {ASSETS.map((a, i) => <option key={a.symbol} value={i}>{a.label}</option>)}
        </select>
        {rsiData && (
          <span style={{ fontSize: 10, color: rsi >= prevRsi ? 'var(--green)' : 'var(--accent)', fontWeight: 700 }}>
            {rsi >= prevRsi ? '▲' : '▼'} {rsi}
          </span>
        )}
      </div>

      <div style={{
        flex: 1,
        display: 'flex', flexDirection: gridW >= 2 ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 6,
      }}>
        <svg width={64} height={64} viewBox="0 0 80 80">
          <circle cx={40} cy={40} r={radius} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle
            cx={40} cy={40} r={radius} fill="none"
            stroke={color} strokeWidth={6}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x={40} y={45} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--ink)">{rsi}</text>
        </svg>
        {gridH >= 2 && (
          <div style={{ textAlign: gridW >= 2 ? 'left' : 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>RSI 14</div>
            <div style={{ fontSize: 11, fontWeight: 700, color }}>{zone}</div>
          </div>
        )}
      </div>
    </div>
  )
}
