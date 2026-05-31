import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { usePrices } from '../../../hooks/usePrices'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const SPARK_DATA = Array.from({ length: 20 }, (_, i) => ({
  i,
  v: 0.6 + 0.4 * Math.sin(i / 2) + 0.1 * Math.cos(i),
}))

export default function MarketVolumeWidget({ gridW = 2, gridH = 1 }: Props) {
  const { all } = usePrices()

  const totalVolume = useMemo(() => all.reduce((sum, a) => sum + a.volume24h, 0), [all])
  const totalCap = useMemo(() => all.reduce((sum, a) => sum + (a.marketCap ?? 0), 0), [all])

  // 1x1 — крупная цифра + label; 2x1 — цифра слева + мини-график справа
  const showSpark = gridW >= 2

  console.debug('[MarketVolumeWidget] gridW=%d gridH=%d spark=%s vol=%d cap=%d', gridW, gridH, showSpark, totalVolume, totalCap)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: showSpark ? '0 0 auto' : 1,
        minWidth: 0,
      }}>
        <span style={{
          fontSize: showSpark ? 22 : 26,
          fontWeight: 800,
          color: 'var(--ink)',
          lineHeight: 1.05,
          fontVariantNumeric: 'tabular-nums',
        }}>
          ${(totalVolume / 1e12).toFixed(2)}T
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>
          Объём 24ч
        </span>
      </div>

      {showSpark && (
        <div style={{ flex: 1, minWidth: 0, height: '70%', minHeight: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SPARK_DATA} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={2} fill="url(#volGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
