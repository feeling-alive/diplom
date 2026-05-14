import { useMemo } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import { formatPrice } from '../../../utils/format'

export default function TrendingCoinsWidget() {
  const { cryptos } = usePrices()

  const coins = useMemo(() => {
    return [...cryptos].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8)
  }, [cryptos])

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 12, display: 'block' }}>Трендовые монеты</span>
      {coins.map((coin) => {
        const isPositive = coin.change24h >= 0
        return (
          <div key={coin.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: coin.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {coin.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{coin.symbol.split('-')[0]}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(coin.price, coin.type)}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: isPositive ? 'var(--green)' : 'var(--accent)', display: 'block' }}>
                {isPositive ? '+' : ''}{coin.change24h.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
