import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { usePrices } from '../../hooks/usePrices'
import type { Asset } from '../../types/market.types'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex' | 'index'

interface Props {
  filter: FilterType
}

interface SectionProps {
  title: string
  items: Asset[]
  positive: boolean
}

function MoverSection({ title, items, positive }: SectionProps) {
  if (items.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 100,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</span>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {positive
          ? <TrendingUp size={14} strokeWidth={2} color="var(--green)" />
          : <TrendingDown size={14} strokeWidth={2} color="var(--accent)" />
        }
      </div>
      {items.map((asset, index) => (
        <motion.div
          key={asset.symbol}
          initial={{ opacity: 0, x: positive ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05, duration: 0.25 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: index < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: asset.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}
          >
            {asset.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
              {asset.symbol}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {asset.name}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
              ${asset.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <span
              className="badge"
              style={{
                background: asset.change24h >= 0 ? '#E8F8EF' : 'var(--accent-bg)',
                color: asset.change24h >= 0 ? 'var(--green)' : 'var(--accent)',
              }}
            >
              {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default function TopMovers({ filter }: Props) {
  const { all, cryptos, stocks, forex, indices } = usePrices()

  const pool = filter === 'all' ? all
    : filter === 'crypto' ? cryptos
    : filter === 'stock' ? stocks
    : filter === 'forex' ? forex
    : indices

  const gainers = [...pool].sort((a, b) => b.change24h - a.change24h).slice(0, 3)
  const losers  = [...pool].sort((a, b) => a.change24h - b.change24h).slice(0, 3)

  console.debug('[TopMovers] filter=', filter, 'pool=', pool.length, 'gainers=', gainers.map(a => a.symbol))

  if (pool.length < 2) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        Нет данных для этой категории
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <MoverSection title="Лидеры роста" items={gainers} positive />
      <MoverSection title="Аутсайдеры"   items={losers}  positive={false} />
    </div>
  )
}
