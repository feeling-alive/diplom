import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { useOHLCV } from '../../../hooks/useOHLCV'
import { useGlobalMarket } from '../../../hooks/useGlobalMarket'
import { formatVolume } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function MarketVolumeWidget({ gridW = 2, gridH = 1 }: Props) {
  // Реальный глобальный объём рынка (CoinGecko /global через бэкенд-прокси), а не
  // сумма volume24h по ~46 локальным активам, которая давала заниженную цифру.
  const { data: global } = useGlobalMarket()
  // Real BTC daily volume drives the sparkline (was a synthetic sine wave).
  const { data: candles } = useOHLCV('BTC-USDT', '1D')

  const totalVolume = global?.totalVolumeUsd ?? 0

  const sparkData = useMemo(
    () => candles.slice(-20).map((c, i) => ({ i, v: c.volume })),
    [candles],
  )

  // 1x1 — крупная цифра + label; 2x1 — цифра слева + мини-график справа
  const showSpark = gridW >= 2 && sparkData.length > 1

  console.debug('[MarketVolumeWidget] gridW=%d gridH=%d spark=%s points=%d vol=%d', gridW, gridH, showSpark, sparkData.length, totalVolume)

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
          {formatVolume(totalVolume)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>
          Объём 24ч
        </span>
      </div>

      {showSpark && (
        <div style={{ flex: 1, minWidth: 0, height: '70%', minHeight: 36 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
