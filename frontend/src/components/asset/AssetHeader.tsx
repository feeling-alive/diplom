import { useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAssetPrice } from '../../hooks/useAssetPrice'
import { useFavorites } from '../../hooks/useFavorites'
import { formatPrice } from '../../utils/format'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

export default function AssetHeader({ asset }: Props) {
  const navigate = useNavigate()
  const { price: livePrice, change24h: liveChange } = useAssetPrice(asset.symbol, asset.type)
  // [4.2] Звезда персистится через бэкенд (модель Favorite) и питает WatchlistPanel.
  const { isFavorite, toggle, isLoggedIn } = useFavorites()
  const isStarred = isFavorite(asset.symbol)

  const price = livePrice || asset.price
  const change24h = liveChange || asset.change24h
  const positive = change24h >= 0

  console.debug('[AssetHeader] %s price=%s change=%s starred=%s', asset.symbol, price, change24h, isStarred)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Back button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/market')}
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '7px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Назад
      </motion.button>

      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: asset.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        {asset.icon}
      </div>

      {/* Name + symbol */}
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{asset.name}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
          {asset.symbol}
        </div>
      </div>

      {/* Price + change */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {formatPrice(price, asset.type)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
          {positive
            ? <TrendingUp size={12} strokeWidth={2} color="var(--green)" />
            : <TrendingDown size={12} strokeWidth={2} color="var(--accent)" />}
          <span
            className="badge"
            style={{
              background: positive ? '#E8F8EF' : 'var(--accent-bg)',
              color: positive ? 'var(--green)' : 'var(--accent)',
            }}
          >
            {positive ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Star button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (!isLoggedIn) {
            console.debug('[AssetHeader] star click but not logged in -> /login')
            navigate('/login')
            return
          }
          console.debug('[AssetHeader] star toggle %s was=%s', asset.symbol, isStarred)
          toggle(asset.symbol)
        }}
        style={{
          background: isStarred ? 'var(--accent)' : 'var(--white)',
          border: '1px solid ' + (isStarred ? 'var(--accent)' : 'var(--border)'),
          borderRadius: 999,
          padding: '8px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: isStarred ? '#fff' : 'var(--ink)',
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        }}
      >
        <Star size={14} strokeWidth={2} fill={isStarred ? '#fff' : 'none'} />
        {isStarred ? 'В списке' : 'Добавить в список'}
      </motion.button>
    </motion.div>
  )
}
