import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePrices } from '../../../hooks/usePrices'
import { formatPrice } from '../../../utils/format'
import type { WidgetSizeProps } from '../../../types/widgets.types'

function bgColor(change: number): string {
  if (change >= 5) return '#16a34a'
  if (change >= 2) return '#22c55e'
  if (change >= 0) return '#86efac'
  if (change >= -2) return '#fca5a5'
  if (change >= -5) return '#ef4444'
  return '#b91c1c'
}

type Props = WidgetSizeProps

export default function HeatmapWidget({ gridW = 4, gridH = 2 }: Props) {
  const { cryptos } = usePrices()
  const navigate = useNavigate()

  // Показывать 16-24 монет в зависимости от сетки
  const cols = gridW >= 4 ? 6 : gridW >= 3 ? 5 : 4
  const limit = gridH >= 3 ? 24 : 16
  
  const data = useMemo(() => {
    return [...cryptos].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, limit)
  }, [cryptos, limit])

  const total = data.reduce((s, c) => s + (c.marketCap ?? 0), 0)

  console.debug('[HeatmapWidget] gridW=%d gridH=%d cols=%d limit=%d', gridW, gridH, cols, limit)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 3, overflow: 'hidden',
    }}>
      {data.map((c) => {
        const w = Math.max(0.4, (c.marketCap ?? 0) / (total || 1) * 8)
        return (
          <motion.div 
            key={c.symbol} 
            whileHover={{ scale: 1.05, zIndex: 10 }}
            onClick={() => navigate(`/asset/${c.symbol}`)}
            aria-label={`${c.name} • ${formatPrice(c.price, c.type)} • ${c.change24h > 0 ? '+' : ''}${c.change24h.toFixed(2)}%`}
            style={{
              background: bgColor(c.change24h),
              borderRadius: 4,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700,
              padding: 2, overflow: 'hidden',
              opacity: 0.7 + Math.min(w, 1.4) * 0.3,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 10 }}>{c.symbol.split('-')[0]}</span>
            <span style={{ fontSize: 8, opacity: 0.9 }}>{c.change24h > 0 ? '+' : ''}{c.change24h.toFixed(1)}%</span>
          </motion.div>
        )
      })}
    </div>
  )
}
