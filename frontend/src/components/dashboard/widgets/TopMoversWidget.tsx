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

  // [3.13] Стабильный детерминированный выбор: топ-рост и топ-падение считаются
  // НЕЗАВИСИМО из полного списка (а не из общего top-20-by-abs пула, чья граница
  // «дрожала» и перетасовывала строки между рендерами). Источник один — usePrices
  // (Query-кэш, рефетч раз в 60с); порядок меняется только при реальном изменении
  // данных, без рандома/перетасовки. tie-break по symbol — устойчивая сортировка.
  const { gainers, losers } = useMemo(() => {
    const byChangeDesc = [...all]
      .filter((s) => s.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h || a.symbol.localeCompare(b.symbol))
    const byChangeAsc = [...all]
      .filter((s) => s.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h || a.symbol.localeCompare(b.symbol))
    return { gainers: byChangeDesc.slice(0, limit), losers: byChangeAsc.slice(0, limit) }
  }, [all, limit])

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
              aria-label={`Открыть ${s.name}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>{s.symbol.split('-')[0]}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                ▲ {formatChange(s.change24h)}
              </span>
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
              aria-label={`Открыть ${s.name}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>{s.symbol.split('-')[0]}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                ▼ {formatChange(s.change24h)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
