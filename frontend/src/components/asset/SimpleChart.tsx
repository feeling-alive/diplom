import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useOHLCV } from '../../hooks/useOHLCV'
import type { Timeframe } from '../../types/market.types'

interface Props {
  symbol: string
  change24h: number
}

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1H', label: '1Ч' },
  { key: '4H', label: '4Ч' },
  { key: '1D', label: '1Д' },
  { key: '1W', label: '1Н' },
  { key: '1M', label: '1М' },
]

function formatTime(ts: number, tf: Timeframe): string {
  const d = new Date(ts)
  if (tf === '1H' || tf === '4H') {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function TooltipContent({ active, payload, label, tf }: { active?: boolean; payload?: Array<{ value: number }>; label?: number; tf: Timeframe }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--muted)', fontSize: 10, marginBottom: 2 }}>
        {label !== undefined ? formatTime(label, tf) : ''}
      </div>
      <div style={{ color: 'var(--ink)', fontWeight: 700 }}>
        ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: 360,
      background: 'linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%)',
      backgroundSize: '200% 100%',
      borderRadius: 12,
      animation: 'shimmer 1.5s linear infinite',
    }} />
  )
}

export default function SimpleChart({ symbol, change24h }: Props) {
  const [tf, setTf] = useState<Timeframe>('1D')
  const { data, isLoading } = useOHLCV(symbol, tf)

  const positive = change24h >= 0
  const color = positive ? 'var(--green)' : 'var(--accent)'
  const colorHex = positive ? '#22c55e' : '#E11D48'

  const chartData = useMemo(
    () => data.map((p) => ({ time: p.timestamp, close: p.close })),
    [data],
  )

  console.debug('[SimpleChart] symbol=%s tf=%s points=%d positive=%s', symbol, tf, chartData.length, positive)

  return (
    <div style={{ width: '100%' }}>
      {/* Timeframe pills */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 4,
        marginBottom: 12,
      }}>
        {TIMEFRAMES.map((t) => (
          <motion.button
            key={t.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.debug('[SimpleChart] timeframe changed to %s', t.key)
              setTf(t.key)
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: 'none',
              background: tf === t.key ? 'var(--ink)' : 'transparent',
              color: tf === t.key ? '#fff' : 'var(--muted)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 360 }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`chartFill-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorHex} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={(ts: number) => formatTime(ts, tf)}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                width={60}
              />
              <Tooltip
                content={<TooltipContent tf={tf} />}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={colorHex}
                strokeWidth={2}
                fill={`url(#chartFill-${positive ? 'up' : 'down'})`}
                activeDot={{ r: 4, fill: colorHex, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
