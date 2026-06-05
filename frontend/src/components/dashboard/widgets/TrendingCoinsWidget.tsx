import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePrices } from '../../../hooks/usePrices'
import { formatPrice } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function TrendingCoinsWidget({ gridW = 2, gridH = 2 }: Props) {
  const { cryptos } = usePrices()
  const navigate = useNavigate()

  // Make limit large enough to allow scrolling
  const limit = 20
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
      {coins.map((coin, idx) => {
        const isPositive = coin.change24h >= 0
        const isLast = idx === coins.length - 1
        return (
          <motion.div
            key={coin.symbol}
            whileHover={{ backgroundColor: 'var(--bg)', x: 2 }}
            onClick={() => {
              console.debug('[TrendingCoinsWidget] navigate to /asset/%s', coin.symbol)
              navigate(`/asset/${coin.symbol}`)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: compact ? 6 : 10,
              padding: compact ? '4px 2px' : '6px 8px',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
              borderRadius: 6,
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
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {coin.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
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
          </motion.div>
        )
      })}
      </div>
    </div>
  )
}
