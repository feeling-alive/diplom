import { useMemo } from 'react'
import { usePrices } from '../../../hooks/usePrices'
import { formatChange } from '../../../utils/format'

export default function TopMoversWidget() {
  const { all } = usePrices()

  const sorted = useMemo(() => {
    return [...all].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 10)
  }, [all])

  const gainers = sorted.filter((s) => s.change24h > 0).slice(0, 5)
  const losers = sorted.filter((s) => s.change24h < 0).slice(0, 5)

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, minHeight: 320 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>▲ Рост</span>
          {gainers.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</span>}
          {gainers.map((s) => (
            <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.symbol.split('-')[0]}</span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{formatChange(s.change24h)}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>▼ Падение</span>
          {losers.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</span>}
          {losers.map((s) => (
            <div key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.symbol.split('-')[0]}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{formatChange(s.change24h)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
