import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForexRate } from '../../../hooks/useForexRate'
import type { WidgetSizeProps } from '../../../types/widgets.types'

interface Pair { from: string; to: string; label: string; flags: string }

// Полный набор пар из Frankfurter (3.2): мажоры + кроссы + ключевые валюты.
// Курс каждой пары тянется реально через useForexRate (бэкенд /api/quotes/forex).
const PAIRS: Pair[] = [
  { from: 'EUR', to: 'USD', label: 'EUR/USD', flags: '🇪🇺🇺🇸' },
  { from: 'GBP', to: 'USD', label: 'GBP/USD', flags: '🇬🇧🇺🇸' },
  { from: 'USD', to: 'JPY', label: 'USD/JPY', flags: '🇺🇸🇯🇵' },
  { from: 'USD', to: 'CHF', label: 'USD/CHF', flags: '🇺🇸🇨🇭' },
  { from: 'USD', to: 'CAD', label: 'USD/CAD', flags: '🇺🇸🇨🇦' },
  { from: 'AUD', to: 'USD', label: 'AUD/USD', flags: '🇦🇺🇺🇸' },
  { from: 'NZD', to: 'USD', label: 'NZD/USD', flags: '🇳🇿🇺🇸' },
  { from: 'USD', to: 'CNY', label: 'USD/CNY', flags: '🇺🇸🇨🇳' },
  { from: 'EUR', to: 'GBP', label: 'EUR/GBP', flags: '🇪🇺🇬🇧' },
  { from: 'EUR', to: 'JPY', label: 'EUR/JPY', flags: '🇪🇺🇯🇵' },
  { from: 'GBP', to: 'JPY', label: 'GBP/JPY', flags: '🇬🇧🇯🇵' },
  { from: 'USD', to: 'SEK', label: 'USD/SEK', flags: '🇺🇸🇸🇪' },
  { from: 'USD', to: 'PLN', label: 'USD/PLN', flags: '🇺🇸🇵🇱' },
  { from: 'USD', to: 'TRY', label: 'USD/TRY', flags: '🇺🇸🇹🇷' },
  { from: 'USD', to: 'INR', label: 'USD/INR', flags: '🇺🇸🇮🇳' },
]

type Props = WidgetSizeProps

export default function ForexRatesWidget({ gridW = 2, gridH = 2 }: Props) {
  const navigate = useNavigate()

  // Растёт вниз: высокий виджет показывает весь набор пар со скроллом, а не обрезок.
  const limit = gridH >= 4 ? PAIRS.length : gridH >= 3 ? 10 : gridH >= 2 ? 6 : 4
  const visiblePairs = PAIRS.slice(0, limit)

  console.debug('[ForexRatesWidget] gridW=%d gridH=%d pairs=%d', gridW, gridH, visiblePairs.length)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        paddingRight: 4,
      }}
    >
      {visiblePairs.map((p, idx) => {
        const isLast = idx === visiblePairs.length - 1
        return (
          <ListCell 
            key={p.label} 
            pair={p} 
            isLast={isLast} 
            onClick={() => {
              console.debug('[ForexRatesWidget] navigate to /asset/%s', p.from + '-' + p.to)
              navigate(`/asset/${p.from}-${p.to}`)
            }} 
          />
        )
      })}
    </div>
  )
}

function ListCell({ pair, isLast, onClick }: { pair: Pair; isLast: boolean; onClick: () => void }) {
  const { rate, isLoading } = useForexRate(pair.from, pair.to)

  return (
    <motion.div 
      whileHover={{ backgroundColor: 'var(--bg)', x: 2 }}
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 4px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>{pair.flags}</span>
        <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{pair.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {isLoading ? '…' : Number.isFinite(rate) && rate > 0 ? rate.toFixed(4) : '—'}
        </span>
      </div>
    </motion.div>
  )
}
