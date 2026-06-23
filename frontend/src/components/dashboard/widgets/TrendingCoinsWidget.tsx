import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTrending } from '../../../hooks/useTrending'
import { formatPrice } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

// Детерминированный цвет аватара по символу (CSS-круг с инициалом — внешние
// картинки запрещены правилами проекта).
function symbolColor(symbol: string): string {
  let hash = 0
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}

export default function TrendingCoinsWidget({ gridW = 2, gridH = 2 }: Props) {
  // Реальные трендовые монеты CoinGecko /search/trending (через бэкенд-прокси),
  // а не локальный список, отсортированный по объёму (Задача B1).
  const { data: coins, isLoading } = useTrending()
  const navigate = useNavigate()

  const compact = gridW <= 1

  console.debug('[TrendingCoinsWidget] gridW=%d gridH=%d coins=%d compact=%s', gridW, gridH, coins.length, compact)

  if (isLoading && coins.length === 0) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }
  if (coins.length === 0) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Нет данных</div>
  }

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
        const isLast = idx === coins.length - 1
        const initial = coin.symbol.slice(0, 1).toUpperCase()
        return (
          <motion.div
            key={coin.id}
            whileHover={{ backgroundColor: 'var(--bg)', x: 2 }}
            onClick={() => {
              const target = `${coin.symbol}-USDT`
              console.debug('[TrendingCoinsWidget] navigate to /asset/%s', target)
              navigate(`/asset/${target}`)
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
              borderRadius: '50%', background: symbolColor(coin.symbol),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: compact ? 9 : 10, fontWeight: 700, flexShrink: 0,
            }}>
              {initial}
            </div>
            {!compact && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {coin.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {coin.symbol}{coin.marketCapRank ? ` · #${coin.marketCapRank}` : ''}
                </span>
              </div>
            )}
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: compact ? 'auto' : 0 }}>
              <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: 'var(--ink)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                {coin.priceUsd > 0 ? formatPrice(coin.priceUsd, 'crypto') : '—'}
              </span>
            </div>
          </motion.div>
        )
      })}
      </div>
    </div>
  )
}
