import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'
import { usePrices } from '../../hooks/usePrices'
import { useFavorites } from '../../hooks/useFavorites'
import { formatPrice } from '../../utils/format'

interface Props extends WidgetSizeProps {
  assets?: Asset[]
}

// Сколько строк помещается при данной высоте (в ячейках сетки 110px).
const ROWS_PER_GRID_H: Record<number, number> = { 2: 4, 3: 8, 4: 12 }

export default function WatchlistPanel({ assets: propAssets, gridW = 2, gridH = 2 }: Props) {
  const { bySymbol, isLoading, lastUpdated } = usePrices()
  const { symbols: favSymbols, isLoggedIn } = useFavorites()
  const navigate = useNavigate()
  const rowsLimit = ROWS_PER_GRID_H[gridH] ?? 4

  // [4.2] Воч-лист = ТОЛЬКО избранные пользователя (модель Favorite через
  // useFavorites), а не все крипто-активы из usePrices. Символы избранного
  // маппятся на живые цены; неизвестные символы пропускаются.
  const favoriteAssets = favSymbols
    .map((s) => bySymbol[s] ?? bySymbol[s.toUpperCase()])
    .filter((a): a is Asset => Boolean(a))
  const assets = propAssets ?? favoriteAssets.slice(0, rowsLimit)
  // gridW === 1 → компактный режим (только иконка + цена + change%)
  const compact = gridW <= 1

  console.debug(
    '[WatchlistPanel] gridW=%d gridH=%d favs=%d rows=%d compact=%s loading=%s updated=%s',
    gridW, gridH, favSymbols.length, assets.length, compact, isLoading,
    lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'never',
  )

  if (assets.length === 0) {
    // Пустой воч-лист → понятный CTA вместо «Пусто».
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
        textAlign: 'center', boxSizing: 'border-box',
      }}>
        <Star size={22} style={{ color: 'var(--soft, var(--muted))' }} />
        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          {isLoggedIn
            ? 'Добавьте активы в избранное ⭐ на странице актива — они появятся здесь'
            : 'Войдите и добавьте активы в избранное, чтобы видеть их здесь'}
        </span>
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
          <span
            role="button"
            tabIndex={0}
            onClick={() => {
              console.debug('[WatchlistPanel] "Все" → navigate to /market')
              navigate('/market')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/market')
              }
            }}
            style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
          >
            Все →
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {assets.map((asset, idx) => {
          const isPositive = asset.change24h >= 0
          const isLast = idx === assets.length - 1
          return (
            <motion.div
              key={asset.symbol}
              whileHover={{ backgroundColor: 'var(--bg)', x: 4 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                console.debug('[WatchlistPanel] navigating to /asset/%s', asset.symbol)
                navigate(`/asset/${asset.symbol}`)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: compact ? 6 : 10,
                padding: compact ? '4px' : '6px 8px',
                cursor: 'pointer',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                borderRadius: 6,
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
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
