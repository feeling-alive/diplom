import { useState, useMemo } from 'react'
import { useOHLCV } from '../../../hooks/useOHLCV'
import type { WidgetSizeProps } from '../../../types/widgets.types'
import type { PricePoint } from '../../../types/market.types'

type Props = WidgetSizeProps

const ASSETS = [
  { symbol: 'BTC-USDT', label: 'BTC' },
  { symbol: 'ETH-USDT', label: 'ETH' },
  { symbol: 'SOL-USDT', label: 'SOL' },
]

type Signal = 'buy' | 'neutral' | 'sell'

function calculateRSI(data: PricePoint[], period = 14): number | null {
  if (data.length <= period) return null
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
  let rsi = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss))
  for (let i = period + 1; i < sorted.length; i++) {
    const change = sorted[i].close - sorted[i - 1].close
    avgGain = ((avgGain * (period - 1)) + Math.max(change, 0)) / period
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-change, 0)) / period
    rsi = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss))
  }
  return rsi
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema = [data[0]]
  for (let i = 1; i < data.length; i++) ema.push(data[i] * k + ema[i - 1] * (1 - k))
  return ema
}

function calculateMACDValue(data: PricePoint[]): { macd: number; signal: number } | null {
  if (data.length < 26) return null
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const closes = sorted.map(p => p.close)
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1]
  // Signal = EMA9 of MACD line
  const macdSeries = ema12.map((v, i) => v - ema26[i])
  const signalArr = calculateEMA(macdSeries, 9)
  return { macd, signal: signalArr[signalArr.length - 1] }
}

function calculateMA(data: PricePoint[], period = 20): number | null {
  if (data.length < period) return null
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  const slice = sorted.slice(-period)
  return slice.reduce((s, p) => s + p.close, 0) / period
}

interface IndicatorStatus { label: string; status: Signal }

interface EvalInput {
  rsi: number | null
  macdData: { macd: number; signal: number } | null
  ma20: number | null
  ma50: number | null
  lastPrice: number
}

// round 3 (B2): раньше вердикт почти всегда был «Нейтрально» — RSI в 30–70 (т.е.
// почти всегда) считался нейтральным и не давал направления, а порог ±2 требовал
// согласия MACD и MA20. Теперь, как в backend/features.py (RSI + MACD-кросс +
// тренд SMA20/SMA50), используем градуированный счёт: каждый индикатор даёт вес,
// сумма решает вердикт. Так результат реально меняется по активу.
function evaluateSignal({ rsi, macdData, ma20, ma50, lastPrice }: EvalInput): { signal: Signal; score: number; indicators: IndicatorStatus[] } {
  const indicators: IndicatorStatus[] = []
  let score = 0

  const lean = (v: number): Signal => (v > 0 ? 'buy' : v < 0 ? 'sell' : 'neutral')

  if (rsi !== null) {
    // Градуированный RSI: перепроданность/перекупленность сильнее, мягкий уклон в зоне 30–70.
    const w = rsi < 30 ? 2 : rsi < 45 ? 1 : rsi <= 55 ? 0 : rsi <= 70 ? -1 : -2
    score += w
    indicators.push({ label: 'RSI', status: lean(w) })
  }
  if (macdData) {
    const w = macdData.macd > macdData.signal ? 1 : macdData.macd < macdData.signal ? -1 : 0
    score += w
    indicators.push({ label: 'MACD', status: lean(w) })
  }
  if (ma20 !== null) {
    const w = lastPrice > ma20 ? 1 : lastPrice < ma20 ? -1 : 0
    score += w
    indicators.push({ label: 'MA20', status: lean(w) })
  }
  if (ma20 !== null && ma50 !== null) {
    // Тренд: золотой/мёртвый крест SMA20 vs SMA50.
    const w = ma20 > ma50 ? 1 : ma20 < ma50 ? -1 : 0
    score += w
    indicators.push({ label: 'Тренд', status: lean(w) })
  }

  let signal: Signal = 'neutral'
  if (score >= 2) signal = 'buy'
  else if (score <= -2) signal = 'sell'

  return { signal, score, indicators }
}

export default function TechnicalAnalysisWidget({ gridW = 2, gridH = 2 }: Props) {
  const [symbolIdx, setSymbolIdx] = useState(0)
  const selected = ASSETS[symbolIdx]
  const { data: ohlcv } = useOHLCV(selected.symbol, '1D')

  const result = useMemo(() => {
    if (ohlcv.length === 0) return null
    const sorted = [...ohlcv].sort((a, b) => a.timestamp - b.timestamp)
    const rsi = calculateRSI(sorted)
    const macd = calculateMACDValue(sorted)
    const ma20 = calculateMA(sorted, 20)
    const ma50 = calculateMA(sorted, 50)
    const lastPrice = sorted[sorted.length - 1].close
    return evaluateSignal({ rsi, macdData: macd, ma20, ma50, lastPrice })
  }, [ohlcv])

  const value = result?.signal === 'buy' ? 75 : result?.signal === 'sell' ? 25 : 50
  const label = result?.signal === 'buy' ? 'Покупать' : result?.signal === 'sell' ? 'Продавать' : 'Нейтрально'
  const color = result?.signal === 'buy' ? '#22c55e' : result?.signal === 'sell' ? '#ef4444' : '#f59e0b'
  const angle = Math.PI - (value / 100) * Math.PI

  console.debug('[TechnicalAnalysisWidget] gridW=%d gridH=%d signal=%s score=%d', gridW, gridH, result?.signal, result?.score)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      boxSizing: 'border-box', overflow: 'hidden', gap: 4,
      padding: 4,
    }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
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
      </div>
      <svg width="100%" height="50%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 220, flex: 1 }}>
        <path d="M 20,90 A 60,60 0 0 1 80,30" stroke="#ef4444" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <path d="M 80,30 A 60,60 0 0 1 110,38" stroke="#f59e0b" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <path d="M 110,38 A 60,60 0 0 1 140,90" stroke="#22c55e" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.25} />
        <line x1={80} y1={90} x2={80 + 50 * Math.cos(angle)} y2={90 - 50 * Math.sin(angle)} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={80} cy={90} r={5} fill={color} />
      </svg>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{label}</div>
      {result && gridH >= 3 && (
        <div style={{ display: 'flex', gap: 6, fontSize: 9, fontWeight: 700, flexWrap: 'wrap', justifyContent: 'center' }}>
          {result.indicators.map((ind) => (
            <span key={ind.label} style={{
              padding: '1px 5px',
              borderRadius: 4,
              background: ind.status === 'buy' ? 'var(--pos-bg)' : ind.status === 'sell' ? 'var(--neg-bg)' : 'var(--bg)',
              color: ind.status === 'buy' ? 'var(--pos)' : ind.status === 'sell' ? 'var(--neg)' : 'var(--muted)',
            }}>
              {ind.label}: {ind.status === 'buy' ? '▲' : ind.status === 'sell' ? '▼' : '—'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
