import { motion, type Variants } from 'framer-motion'
import { TrendingUp, Star, ArrowRight } from 'lucide-react'
import { MOCK_PRICES } from '../../mock/prices.mock'

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const cardBase: React.CSSProperties = {
  borderRadius: 14,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 80,
}

const whiteCard: React.CSSProperties = {
  ...cardBase,
  background: 'var(--white)',
  border: '1px solid var(--border)',
}

function formatPrice(price: number, type: string): string {
  if (type === 'forex') return price.toFixed(4)
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + price.toFixed(2)
}

export default function KpiStrip() {
  const topAsset = MOCK_PRICES[0]
  const bestPosition = MOCK_PRICES[1]
  const cards = MOCK_PRICES.slice(2, 5)

  console.debug('[KpiStrip] rendered with', MOCK_PRICES.length, 'assets')

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 10,
        margin: '8px 0',
      }}
    >
      {/* Card 1 — Top asset */}
      <motion.div variants={cardVariant} style={whiteCard}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Топ актив</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: topAsset.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {topAsset.icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {topAsset.name}
          </span>
          <TrendingUp size={14} strokeWidth={2} color="var(--green)" style={{ marginLeft: 'auto' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
          {formatPrice(topAsset.price, topAsset.type)}
        </span>
      </motion.div>

      {/* Card 2 — Best position (DARK) */}
      <motion.div
        variants={cardVariant}
        style={{
          ...cardBase,
          background: 'var(--ink)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
            Лучшая позиция
          </span>
          <Star size={13} strokeWidth={2} fill="#FBBF24" color="#FBBF24" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: bestPosition.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              border: '1.5px solid rgba(255,255,255,0.2)',
            }}
          >
            {bestPosition.icon}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {bestPosition.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {formatPrice(bestPosition.price, bestPosition.type)}
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowRight size={13} strokeWidth={2.5} color="var(--ink)" />
          </motion.button>
        </div>
      </motion.div>

      {/* Cards 3,4,5 — white data cards */}
      {cards.map((asset) => {
        const isPositive = asset.change24h >= 0
        return (
          <motion.div key={asset.symbol} variants={cardVariant} style={whiteCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: asset.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {asset.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                {asset.symbol.split('-')[0]}
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {formatPrice(asset.price, asset.type)}
            </span>
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

      {/* Slot 6 — "Подробнее" button */}
      <motion.button
        variants={cardVariant}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        style={{
          ...cardBase,
          background: 'var(--ink)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          fontSize: 13,
          fontWeight: 500,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 80,
        }}
      >
        Подробнее
      </motion.button>
    </motion.div>
  )
}
