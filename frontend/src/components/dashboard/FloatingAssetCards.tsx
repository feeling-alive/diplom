import { motion, type Variants } from 'framer-motion'
import { Plus } from 'lucide-react'
import type { Asset } from '../../types/market.types'
import { usePersonalized } from '../../hooks/usePersonalized'
import { MOCK_PRICES } from '../../mock/prices.mock'

interface Props {
  assets?: Asset[]
  onAddClick?: () => void
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const itemVariant: Variants = {
  hidden: { opacity: 0, y: -15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

interface FloatCardProps {
  asset: Asset
  floatDelay: number
}

function FloatCard({ asset, floatDelay }: FloatCardProps) {
  const isPositive = asset.change24h >= 0

  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity, delay: floatDelay }}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: 'pointer',
        minWidth: 110,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: asset.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {asset.icon ?? asset.symbol[0]}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {asset.symbol.split('-')[0]}
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
        {asset.type === 'forex'
          ? asset.price.toFixed(4)
          : asset.price >= 1000
            ? `$${(asset.price / 1000).toFixed(1)}k`
            : `$${asset.price.toFixed(2)}`}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: isPositive ? 'var(--green)' : 'var(--accent)',
        }}
      >
        {isPositive ? '+' : ''}
        {asset.change24h.toFixed(1)}%
      </span>
    </motion.div>
  )
}

export default function FloatingAssetCards({ assets, onAddClick }: Props) {
  const { topAssets } = usePersonalized()
  const displayAssets = assets ?? (topAssets.length > 0 ? topAssets.slice(0, 4) : MOCK_PRICES.slice(0, 4))

  console.debug('[FloatingAssetCards] rendering', displayAssets.length, 'cards')

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 0 4px' }}
    >
      {displayAssets.map((asset, i) => (
        <motion.div key={asset.symbol} variants={itemVariant}>
          <FloatCard asset={asset} floatDelay={i * 0.8} />
        </motion.div>
      ))}

      <motion.button
        variants={itemVariant}
        onClick={onAddClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px dashed var(--border)',
          background: 'none',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          alignSelf: 'center',
          flexShrink: 0,
        }}
        aria-label="Добавить актив"
      >
        <Plus size={16} strokeWidth={2} />
      </motion.button>
    </motion.div>
  )
}
