import { useMemo } from 'react'
import { usePrices } from '../../../hooks/usePrices'

export default function MarketVolumeWidget() {
  const { all } = usePrices()

  const totalVolume = useMemo(() => all.reduce((sum, a) => sum + a.volume24h, 0), [all])
  const totalCap = useMemo(() => all.reduce((sum, a) => sum + (a.marketCap ?? 0), 0), [all])

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 160 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>Объём рынка 24ч</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>${(totalVolume / 1e12).toFixed(2)}T</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Капитализация: ${(totalCap / 1e12).toFixed(2)}T</span>
    </div>
  )
}
