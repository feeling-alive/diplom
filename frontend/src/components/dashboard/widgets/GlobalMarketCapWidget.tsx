import type { WidgetSizeProps } from '../../../types/widgets.types'
import { useGlobalMarket } from '../../../hooks/useGlobalMarket'
import { formatMarketCap, formatVolume } from '../../../utils/format'

type Props = WidgetSizeProps

export default function GlobalMarketCapWidget({ gridW = 2, gridH = 1 }: Props) {
  // Реальные глобальные метрики через бэкенд-прокси (CoinGecko /global + Redis).
  // Раньше виджет ходил в api.coingecko.com прямо из браузера (CORS/лимиты) и
  // кэшировал в localStorage — теперь единый Query-кэш, общий с MarketVolumeWidget.
  const { data, isLoading } = useGlobalMarket()

  if (isLoading && !data) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }
  if (!data) return null

  const showAll = gridH >= 2 || gridW >= 3
  const positive = data.marketCapChange24h >= 0

  console.debug('[GlobalMarketCapWidget] gridW=%d gridH=%d showAll=%s stale=%s', gridW, gridH, showAll, data.isStale)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: showAll ? 'column' : 'row',
      alignItems: 'center', gap: showAll ? 6 : 12,
      overflow: 'hidden', padding: 4,
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Капитализация</div>
        <div style={{ fontSize: showAll ? 18 : 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {formatMarketCap(data.totalMarketCapUsd)}
        </div>
      </div>
      {showAll && (
        <>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Объём 24ч</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {formatVolume(data.totalVolumeUsd)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>BTC дом.</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {data.btcDominance.toFixed(1)}%
            </div>
          </div>
        </>
      )}
      <div style={{
        padding: '3px 8px', borderRadius: 999,
        background: positive ? 'var(--pos-bg)' : 'var(--neg-bg)',
        color: positive ? 'var(--pos)' : 'var(--neg)',
        fontSize: 10, fontWeight: 700, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {positive ? '+' : ''}{data.marketCapChange24h.toFixed(1)}%
      </div>
    </div>
  )
}
