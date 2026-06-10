import { usePersonalized } from '../../hooks/usePersonalized'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'

const TYPE_LABELS: Record<Asset['type'], string> = {
  crypto: 'Крипто',
  stock: 'Акции',
  forex: 'Форекс',
}

function formatPrice(asset: Asset): string {
  if (asset.type === 'forex') return asset.price.toFixed(4)
  if (asset.price >= 1000) return '$' + asset.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + asset.price.toFixed(2)
}

type Props = WidgetSizeProps

export default function PersonalizedPanel({ gridW = 4, gridH = 1 }: Props) {
  const { topAssets, isLoading } = usePersonalized()

  const compact = gridH === 1
  const minimal = gridH === 1 && gridW <= 2

  console.debug('[PersonalizedPanel] gridW=%d gridH=%d compact=%s minimal=%s assets=%d', gridW, gridH, compact, minimal, topAssets.length)

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Загрузка...</span>
      </div>
    )
  }

  if (topAssets.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Нет данных</span>
      </div>
    )
  }

  if (minimal) {
    const first = topAssets[0]!
    const isPositive = first.change24h >= 0
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: first.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {first.icon ?? first.symbol[0]}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first.name}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(first)}</span>
        </div>
        <span style={{
          background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
          color: isPositive ? 'var(--green)' : 'var(--accent)',
          borderRadius: 'var(--r-pill)', padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0,
        }}>
          {isPositive ? '▲' : '▼'} {Math.abs(first.change24h).toFixed(1)}%
        </span>
      </div>
    )
  }

  const uniqueTypes = [...new Set(topAssets.map((a) => a.type))]
  const showTypes = !compact

  if (compact) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 16, overflow: 'auto' }}>
        {topAssets.map((asset) => {
          const isPositive = asset.change24h >= 0
          return (
            <div key={asset.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: asset.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>
                {asset.icon ?? asset.symbol[0]}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(asset)}</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: isPositive ? 'var(--green)' : 'var(--accent)',
              }}>
                {isPositive ? '+' : ''}{asset.change24h.toFixed(1)}%
              </span>
            </div>
          )
        })}
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {topAssets.map((asset) => {
          const isPositive = asset.change24h >= 0
          return (
            <div
              key={asset.symbol}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: asset.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {asset.icon ?? asset.symbol[0]}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {asset.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{formatPrice(asset)}</span>
              <span style={{
                background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
                color: isPositive ? 'var(--green)' : 'var(--accent)',
                borderRadius: 'var(--r-pill)', padding: '2px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0,
              }}>
                {isPositive ? '▲' : '▼'} {Math.abs(asset.change24h).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>

      {showTypes && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {uniqueTypes.map((type) => (
            <span
              key={type}
              style={{
                background: 'var(--bg)',
                color: 'var(--muted)',
                borderRadius: 'var(--r-pill)',
                fontSize: 10,
                padding: '2px 8px',
                fontWeight: 500,
              }}
            >
              {TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
