import { useMemo } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import { formatPrice } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function TrendingCoinsWidget({ gridW = 2, gridH = 2 }: Props) {
  const { cryptos } = usePrices()

  const limit = gridH >= 3 ? 6 : 3
  const coins = useMemo(() => {
    return [...cryptos].sort((a, b) => b.volume24h - a.volume24h).slice(0, limit)
  }, [cryptos, limit])

  console.debug('[TrendingCoinsWidget] gridW=%d gridH=%d coins=%d', gridW, gridH, coins.length)

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
              gap: 10,
              padding: '7px 0',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: coin.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>
              {coin.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {coin.symbol.split('-')[0]}
              </span>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', display: 'block' }}>{formatPrice(coin.price, coin.type)}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: isPositive ? 'var(--green)' : 'var(--accent)', display: 'block' }}>
                {isPositive ? '+' : ''}{coin.change24h.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
