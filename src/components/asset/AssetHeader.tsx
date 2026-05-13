import { useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAssetPrice } from '../../hooks/useAssetPrice'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

function formatPrice(price: number, type: Asset['type']): string {
  if (type === 'forex') return price.toFixed(5)
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

function formatVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${(n / 1e6).toFixed(0)}M`
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  return `$${(n / 1e9).toFixed(1)}B`
}

export default function AssetHeader({ asset }: Props) {
  const navigate = useNavigate()
  const { price, change24h } = useAssetPrice(asset.symbol, asset.type, true)
  const positive = change24h >= 0

  console.debug('[AssetHeader] symbol=', asset.symbol, 'price=', price, 'change24h=', change24h)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{
        padding: '16px 20px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/market')}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 10px',
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
      </button>

      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: asset.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {asset.icon}
      </div>

      {/* Name + symbol */}
      <div style={{ flex: 1, minWidth: 100 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
          {asset.symbol}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.name}</div>
      </div>

      {/* Price + change */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>
          {formatPrice(price, asset.type)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
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

      {/* Volume */}
      {asset.volume24h ? (
        <div
          style={{
            textAlign: 'right',
            paddingLeft: 20,
            borderLeft: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Объём 24ч</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {formatVolume(asset.volume24h)}
          </div>
        </div>
      ) : null}

      {/* Market cap */}
      {asset.marketCap ? (
        <div
          style={{
            textAlign: 'right',
            paddingLeft: 20,
            borderLeft: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Капитализация</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {formatMarketCap(asset.marketCap)}
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
