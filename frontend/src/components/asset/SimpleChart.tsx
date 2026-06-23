import { useState, useMemo, useId } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useOHLCV } from '../../hooks/useOHLCV'
import { convertFromUsd, getCurrencyState, CURRENCY_SYMBOL } from '../../utils/format'
import type { Timeframe, Asset } from '../../types/market.types'

interface Props {
  symbol: string
  change24h: number
  assetType?: Asset['type']
}

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '30m', label: '30м' },
  { key: '1H',  label: '1ч'  },
  { key: '1D',  label: '1д'  },
  { key: '1W',  label: '1н'  },
  { key: '1M',  label: '1м'  },
]

// Intraday timeframes show time; daily+ show the date.
const INTRADAY: Timeframe[] = ['30m', '1H']

function formatTime(ts: number, tf: Timeframe): string {
  const d = new Date(ts)
  if (INTRADAY.includes(tf)) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Currency-aware price label (Задача A5): forex pairs are NOT USD amounts → shown
// raw with 4 decimals; crypto/stock values are USD → converted into the active
// display currency (convertFromUsd) with its symbol. Reads the currency singleton
// at render time, so switching currency re-labels the Y-axis and tooltip.
function withCurrencySymbol(num: string): string {
  const { currency } = getCurrencyState()
  const sym = CURRENCY_SYMBOL[currency]
  return currency === 'RUB' ? `${num} ${sym}` : `${sym}${num}`
}

function formatAxisPrice(value: number, type?: Asset['type']): string {
  if (type === 'forex') return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const v = convertFromUsd(value)
  return withCurrencySymbol(v.toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 4 : 0 }))
}

function formatTooltipPrice(value: number, type?: Asset['type']): string {
  if (type === 'forex') return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const v = convertFromUsd(value)
  return withCurrencySymbol(v.toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 6 : 2 }))
}

function TooltipContent({ active, payload, label, tf, assetType }: { active?: boolean; payload?: Array<{ value: number }>; label?: number; tf: Timeframe; assetType?: Asset['type'] }) {
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
        {formatTooltipPrice(value, assetType)}
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

export default function SimpleChart({ symbol, change24h, assetType }: Props) {
  const [tf, setTf] = useState<Timeframe>('1D')
  const { data, isLoading } = useOHLCV(symbol, tf)

  const positive = change24h >= 0
  const color = positive ? 'var(--green)' : 'var(--accent)'
  const colorHex = positive ? '#22c55e' : '#E11D48'
  // Collision-proof gradient id (multiple charts can share a page / same sign).
  const gradId = `chartFill${useId()}`

  const chartData = useMemo(
    () => data.map((p) => ({ time: p.timestamp, close: p.close })),
    [data],
  )

  const isEmpty = !isLoading && chartData.length === 0

  console.debug('[SimpleChart] symbol=%s tf=%s points=%d positive=%s empty=%s', symbol, tf, chartData.length, positive, isEmpty)

  return (
    <div style={{ width: '100%' }}>
      {/* Timeframe pills */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'nowrap',
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
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              backgroundColor: tf === t.key ? 'var(--accent)' : 'transparent',
              color: tf === t.key ? '#fff' : 'var(--muted)',
              fontSize: 11,
              fontWeight: tf === t.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              whiteSpace: 'nowrap',
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
        ) : isEmpty ? (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
            fontSize: 13,
          }}>
            Нет данных для графика
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(v: number) => formatAxisPrice(v, assetType)}
                width={60}
              />
              <Tooltip
                content={<TooltipContent tf={tf} assetType={assetType} />}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={colorHex}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                activeDot={{ r: 4, fill: colorHex, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
