import { motion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { Asset } from '../../types/market.types'
import { MOCK_PRICES } from '../../mock/prices.mock'

interface Props {
  assets?: Asset[]
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariant: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
}

const CARD_BASE = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  cursor: 'pointer',
  minWidth: 120,
  flexShrink: 0,
  boxShadow: 'var(--shadow-sm)',
} as const

function formatPrice(price: number, type: string): string {
  if (type === 'forex') return price.toFixed(4)
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + price.toFixed(2)
}

export default function AssetStrip({ assets = MOCK_PRICES }: Props) {
  const navigate = useNavigate()
  console.debug('[AssetStrip]', assets.length, 'assets rendered')

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '2px 0 6px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as React.CSSProperties}
    >
      {assets.map((asset) => {
        const isPositive = asset.change24h >= 0
        return (
          <motion.div
            key={asset.symbol}
            variants={itemVariant}
            whileHover={{ y: -1, boxShadow: 'var(--shadow-md)' }}
            onClick={() => navigate(`/asset/${asset.symbol}`)}
            style={CARD_BASE}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: asset.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {asset.symbol.split('-')[0]}
              </span>
            </div>

            {/* Price */}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {formatPrice(asset.price, asset.type)}
            </span>

            {/* Change badge */}
            <span
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
                color: isPositive ? 'var(--green)' : 'var(--accent)',
                borderRadius: 'var(--r-pill)',
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {isPositive ? '+' : ''}
              {asset.change24h.toFixed(1)}%
            </span>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
