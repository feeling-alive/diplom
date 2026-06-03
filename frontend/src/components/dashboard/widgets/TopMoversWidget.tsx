import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrices } from '../../../hooks/usePrices'
import { formatChange } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

export default function TopMoversWidget({ gridW = 2, gridH = 2 }: Props) {
  const { all } = usePrices()
  const navigate = useNavigate()

  // 2x2 → 3 per column, 2x3 → 6 per column, 3x2 → 4 per column (плотные строки, без bottom-пустоты)
  const limit = gridH >= 3 ? 6 : gridW >= 3 ? 4 : 3
  const sorted = useMemo(() => {
    return [...all].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 20)
  }, [all])

  const gainers = sorted.filter((s) => s.change24h > 0).slice(0, limit)
  const losers = sorted.filter((s) => s.change24h < 0).slice(0, limit)

  console.debug('[TopMoversWidget] gridW=%d gridH=%d gainers=%d losers=%d', gridW, gridH, gainers.length, losers.length)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      gap: 16,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, flexShrink: 0 }}>▲ Рост</span>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {gainers.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</span>}
          {gainers.map((s) => (
            <div
              key={s.symbol}
              onClick={() => navigate('/asset/' + encodeURIComponent(s.symbol))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/asset/' + encodeURIComponent(s.symbol)) } }}
              role="button"
              tabIndex={0}
              title={`Открыть ${s.symbol}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.symbol.split('-')[0]}</span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>{formatChange(s.change24h)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, flexShrink: 0 }}>▼ Падение</span>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {losers.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</span>}
          {losers.map((s) => (
            <div
              key={s.symbol}
              onClick={() => navigate('/asset/' + encodeURIComponent(s.symbol))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/asset/' + encodeURIComponent(s.symbol)) } }}
              role="button"
              tabIndex={0}
              title={`Открыть ${s.symbol}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.symbol.split('-')[0]}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{formatChange(s.change24h)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
