import { usePersonalized } from '../../hooks/usePersonalized'
import type { Asset } from '../../types/market.types'

const TYPE_LABELS: Record<Asset['type'], string> = {
  crypto: 'Крипто',
  stock: 'Акции',
  forex: 'Форекс',
  index: 'Индексы',
}

export default function PersonalizedPanel() {
  const { topAssets, isLoading } = usePersonalized()

  console.debug('[PersonalizedPanel] topAssets=', topAssets.map((a) => a.symbol))

  if (isLoading) {
    return (
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          minHeight: 200,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Часто просматриваете
        </span>
      </div>
    )
  }

  if (topAssets.length === 0) {
    return (
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Нет данных</span>
      </div>
    )
  }

  // Unique category tags from topAssets
  const uniqueTypes = [...new Set(topAssets.map((a) => a.type))]

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        Часто просматриваете
      </span>

      {/* Asset rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
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
              {/* Avatar */}
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
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {asset.icon ?? asset.symbol[0]}
              </div>

              {/* Name */}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {asset.name}
              </span>

              {/* Price */}
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                {asset.type === 'forex'
                  ? asset.price.toFixed(4)
                  : asset.price >= 1000
                    ? '$' + asset.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : '$' + asset.price.toFixed(2)}
              </span>

              {/* Trend badge */}
              <span
                style={{
                  background: isPositive ? '#E8F8EF' : 'var(--accent-bg)',
                  color: isPositive ? 'var(--green)' : 'var(--accent)',
                  borderRadius: 'var(--r-pill)',
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {isPositive ? '▲' : '▼'} {Math.abs(asset.change24h).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Category tag pills */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
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
    </div>
  )
}
