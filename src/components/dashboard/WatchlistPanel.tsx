import { motion } from 'framer-motion'
import type { Asset } from '../../types/market.types'
import { usePrices } from '../../hooks/usePrices'
import { formatPrice } from '../../utils/format'

interface Props {
  assets?: Asset[]
}

export default function WatchlistPanel({ assets: propAssets }: Props) {
  const { cryptos } = usePrices()
  const assets = propAssets ?? cryptos.slice(0, 10)

  if (assets.length === 0) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Вотчлист пуст — добавьте активы</span>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Вотчлист</span>
        <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>Смотреть всё →</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {assets.map((asset, idx) => {
          const isPositive = asset.change24h >= 0
          const isLast = idx === assets.length - 1
          return (
            <motion.div key={asset.symbol} whileHover={{ backgroundColor: 'var(--bg)', borderRadius: 8, paddingLeft: 8, marginLeft: -8 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'padding-left 0.15s, margin-left 0.15s' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: asset.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {asset.icon ?? asset.symbol[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{asset.symbol.split('-')[0]}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(asset.price, asset.type)}</span>
                <span style={{ background: isPositive ? '#E8F8EF' : 'var(--accent-bg)', color: isPositive ? 'var(--green)' : 'var(--accent)', borderRadius: 'var(--r-pill)', padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                  {isPositive ? '+' : ''}{asset.change24h.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
