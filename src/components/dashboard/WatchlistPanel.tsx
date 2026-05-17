import { motion } from 'framer-motion'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'
import { usePrices } from '../../hooks/usePrices'
import { formatPrice } from '../../utils/format'

interface Props extends WidgetSizeProps {
  assets?: Asset[]
}

export default function WatchlistPanel({ assets: propAssets, gridW = 2, gridH = 2 }: Props) {
  const { cryptos, isLoading, lastUpdated } = usePrices()
  const rowsLimit = gridH >= 3 ? 10 : 4
  const assets = propAssets ?? cryptos.slice(0, rowsLimit)
  const showName = gridW >= 3

  console.debug(
    '[WatchlistPanel] gridW=%d gridH=%d rows=%d loading=%s updated=%s',
    gridW, gridH, assets.length, isLoading,
    lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'never',
  )

  if (assets.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Вотчлист пуст — добавьте активы</span>
      </div>
    )
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>Смотреть всё →</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {assets.map((asset, idx) => {
          const isPositive = asset.change24h >= 0
          const isLast = idx === assets.length - 1
          return (
            <motion.div
              key={asset.symbol}
              whileHover={{ backgroundColor: 'var(--bg)', borderRadius: 8, paddingLeft: 8, marginLeft: -8 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                cursor: 'pointer',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                transition: 'padding-left 0.15s, margin-left 0.15s',
                flexShrink: 0,
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: asset.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {asset.icon ?? asset.symbol[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.symbol.split('-')[0]}
                </div>
                {showName && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(asset.price, asset.type)}</span>
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

