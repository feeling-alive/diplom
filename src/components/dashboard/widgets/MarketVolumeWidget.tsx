import { useMemo } from 'react'
import { MOCK_PRICES } from '../../../mock/prices.mock'

export default function MarketVolumeWidget() {
  const totalVolume = useMemo(() => {
    return MOCK_PRICES.reduce((sum, a) => sum + a.volume24h, 0)
  }, [])

  // Mock 24h change
  const changePercent = 3.7
  const isPositive = changePercent >= 0

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 160,
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>
        Объём рынка 24ч
      </span>
      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>
        ${(totalVolume / 1e12).toFixed(2)}T
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: isPositive ? 'var(--green)' : 'var(--accent)',
          marginTop: 4,
        }}
      >
        {isPositive ? '+' : ''}{changePercent.toFixed(1)}% от вчера
      </span>
    </div>
  )
}