import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useOHLCV } from '../../hooks/useOHLCV'
import { useAssetPrice } from '../../hooks/useAssetPrice'
import { MOCK_PRICES } from '../../mock/prices.mock'
import type { Timeframe } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'

const ASSET_OPTIONS = [
  { symbol: 'BTC-USDT', label: 'BTC', type: 'crypto' as const },
  { symbol: 'ETH-USDT', label: 'ETH', type: 'crypto' as const },
  { symbol: 'AAPL', label: 'AAPL', type: 'stock' as const },
  { symbol: 'EUR-USD', label: 'EUR/USD', type: 'forex' as const },
]

type ChartTF = '1Д' | '1Н' | '1М' | '3М'

const TF_MAP: Record<ChartTF, Timeframe> = {
  '1Д': '1D',
  '1Н': '1W',
  '1М': '1M',
  '3М': '1M',
}

const CHART_TFS: ChartTF[] = ['1Д', '1Н', '1М', '3М']

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

function formatPrice(price: number, type: string): string {
  if (type === 'forex') return price.toFixed(4)
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + price.toFixed(2)
}

interface ChartPoint {
  time: string
  close: number
  raw: number
}

interface TooltipEntry { value?: number }
interface CustomTooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
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
      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>${val.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
      <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
  )
}

type Props = WidgetSizeProps

export default function PriceChartWidget({ gridW = 3, gridH = 2 }: Props) {
  const [selectedSymbolIdx, setSelectedSymbolIdx] = useState(0)
  const [activeTF, setActiveTF] = useState<ChartTF>('1Д')

  const selected = ASSET_OPTIONS[selectedSymbolIdx]!
  const timeframe = TF_MAP[activeTF]

  const { data: ohlcvData, isLoading } = useOHLCV(selected.symbol, timeframe)
  const { price, change24h } = useAssetPrice(selected.symbol, selected.type)

  const assetMeta = MOCK_PRICES.find((a) => a.symbol === selected.symbol)
  const isPositive = change24h >= 0
  const showTimeframes = gridH >= 2

  const chartData = useMemo<ChartPoint[]>(() => {
    const step = Math.max(1, Math.floor(ohlcvData.length / 40))
    return ohlcvData
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        time: formatTimestamp(p.timestamp),
        close: +p.close.toFixed(6),
        raw: p.close,
      }))
  }, [ohlcvData])

  console.debug('[PriceChartWidget] gridW=%d gridH=%d symbol=%s tf=%s points=%d', gridW, gridH, selected.symbol, activeTF, chartData.length)

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
      {/* Top row: asset selector + price + change */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <select
          value={selectedSymbolIdx}
          onChange={(e) => setSelectedSymbolIdx(Number(e.target.value))}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 8px',
            background: 'var(--white)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          {ASSET_OPTIONS.map((opt, i) => (
            <option key={opt.symbol} value={i}>
              {opt.label}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {assetMeta ? formatPrice(price, selected.type) : '—'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isPositive ? 'var(--green)' : 'var(--accent)',
              background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
              borderRadius: 'var(--r-pill)',
              padding: '2px 6px',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isPositive ? '+' : ''}
            {Number.isFinite(change24h) ? change24h.toFixed(1) : '0.0'}%
          </span>
        </div>

        {/* Timeframe buttons — only when there's vertical room */}
        {showTimeframes && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {CHART_TFS.map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTF(tf)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  background: activeTF === tf ? 'var(--ink)' : 'var(--bg)',
                  color: activeTF === tf ? '#fff' : 'var(--muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      {isLoading ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
            fontSize: 13,
          }}
        >
          Загрузка...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8264A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#E8264A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#E8264A"
              strokeWidth={2.5}
              fill="url(#chartGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#E8264A', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      </div>
    </div>
  )
}
