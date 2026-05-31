import { motion } from 'framer-motion'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'
import { usePrices } from '../../hooks/usePrices'
import { formatPrice } from '../../utils/format'

interface Props extends WidgetSizeProps {
  assets?: Asset[]
}

// Сколько строк помещается при данной высоте (в ячейках сетки 110px).
const ROWS_PER_GRID_H: Record<number, number> = { 2: 4, 3: 8, 4: 12 }

export default function WatchlistPanel({ assets: propAssets, gridW = 2, gridH = 2 }: Props) {
  const { cryptos, isLoading, lastUpdated } = usePrices()
  const rowsLimit = ROWS_PER_GRID_H[gridH] ?? 4
  const assets = propAssets ?? cryptos.slice(0, rowsLimit)
  // gridW === 1 → компактный режим (только иконка + цена + change%)
  const compact = gridW <= 1

  console.debug(
    '[WatchlistPanel] gridW=%d gridH=%d rows=%d compact=%s loading=%s updated=%s',
    gridW, gridH, assets.length, compact, isLoading,
    lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'never',
  )

  if (assets.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Пусто</span>
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
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>Все →</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {assets.map((asset, idx) => {
          const isPositive = asset.change24h >= 0
          const isLast = idx === assets.length - 1
          return (
            <motion.div
              key={asset.symbol}
              whileHover={{ backgroundColor: 'var(--bg)' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: compact ? 6 : 10,
                padding: compact ? '6px 4px' : '8px 0',
                cursor: 'pointer',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                borderRadius: compact ? 6 : 0,
                flexShrink: 0,
              }}
            >
              <div style={{
                width: compact ? 22 : 28,
                height: compact ? 22 : 28,
                borderRadius: '50%',
                background: asset.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: compact ? 10 : 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {asset.icon ?? asset.symbol[0]}
              </div>

              {!compact && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.symbol.split('-')[0]}
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex',
                flexDirection: compact ? 'row' : 'column',
                alignItems: compact ? 'center' : 'flex-end',
                gap: compact ? 6 : 2,
                marginLeft: compact ? 'auto' : 0,
                flexShrink: 0,
                minWidth: 0,
              }}>
                <span style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatPrice(asset.price, asset.type)}
                </span>
                <span style={{
                  background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
                  color: isPositive ? 'var(--green)' : 'var(--accent)',
                  borderRadius: 'var(--r-pill)',
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {isPositive ? '+' : ''}{Number.isFinite(asset.change24h) ? asset.change24h.toFixed(1) : '0.0'}%
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
