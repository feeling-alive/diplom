import { useMemo } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import { formatPrice } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function TrendingCoinsWidget({ gridW = 2, gridH = 2 }: Props) {
  const { cryptos } = usePrices()

  // Растёт только вниз — больше монет на больших gridH
  const limit = gridH >= 4 ? 11 : gridH >= 3 ? 8 : 5
  const compact = gridW <= 1
  const coins = useMemo(() => {
    return [...cryptos].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit)
  }, [cryptos, limit])

  console.debug('[TrendingCoinsWidget] gridW=%d gridH=%d coins=%d compact=%s', gridW, gridH, coins.length, compact)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {coins.map((coin, idx) => {
        const isPositive = coin.change24h >= 0
        const isLast = idx === coins.length - 1
        return (
          <div
            key={coin.symbol}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 6 : 10,
              padding: compact ? '5px 2px' : '6px 0',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: compact ? 22 : 26, height: compact ? 22 : 26,
              borderRadius: '50%', background: coin.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: compact ? 9 : 10, fontWeight: 700, flexShrink: 0,
            }}>
              {coin.icon}
            </div>
            {!compact && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {coin.symbol.split('-')[0]}
                </span>
              </div>
            )}
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: compact ? 'auto' : 0 }}>
              <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: 'var(--ink)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(coin.price, coin.type)}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: isPositive ? 'var(--green)' : 'var(--accent)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                {isPositive ? '+' : ''}{Number.isFinite(coin.change24h) ? coin.change24h.toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
