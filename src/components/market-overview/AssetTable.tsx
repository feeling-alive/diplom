import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { MOCK_PRICES } from '../../mock/prices.mock'
import { getMockOHLCV } from '../../mock/ohlcv.mock'
import type { Asset } from '../../types/market.types'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex' | 'index'
type SortKey = 'price' | 'change24h' | 'volume24h' | 'marketCap'
type SortDir = 'asc' | 'desc'

interface Props {
  filter: FilterType
}

const GRID = '32px 2fr 1.2fr 1fr 1fr 1fr 72px'

function formatPrice(price: number, type: Asset['type']): string {
  if (type === 'forex') return price.toFixed(5)
  if (price >= 1000)    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (price >= 1)       return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

function formatBillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}

function formatTrillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}

function SparklineCell({ symbol, positive }: { symbol: string; positive: boolean }) {
  const points = useMemo(() => getMockOHLCV(symbol, 20).map(p => p.close), [symbol])
  const color = positive ? 'var(--green)' : 'var(--accent)'
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const pts = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 58 + 1
      const y = 29 - ((p - min) / range) * 28
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={60} height={30} viewBox="0 0 60 30" style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface HeaderCellProps {
  label: string
  sortKey?: SortKey
  activeSortKey: SortKey
  sortDir: SortDir
  onSort?: (key: SortKey) => void
  align?: 'left' | 'right'
}

function HeaderCell({ label, sortKey, activeSortKey, sortDir, onSort, align = 'left' }: HeaderCellProps) {
  const isActive = sortKey && activeSortKey === sortKey
  return (
    <div
      onClick={sortKey && onSort ? () => onSort(sortKey) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        fontSize: 10,
        color: isActive ? 'var(--ink)' : 'var(--muted)',
        fontWeight: 500,
        cursor: sortKey ? 'pointer' : 'default',
        userSelect: 'none',
        padding: '0 0 10px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {label}
      {isActive && (
        sortDir === 'asc'
          ? <ChevronUp size={10} strokeWidth={2} />
          : <ChevronDown size={10} strokeWidth={2} />
      )}
    </div>
  )
}

export default function AssetTable({ filter }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const rows = useMemo(() => {
    const filtered = filter === 'all'
      ? MOCK_PRICES
      : MOCK_PRICES.filter(a => a.type === filter)

    return [...filtered].sort((a, b) => {
      const va = (a[sortKey] as number) ?? 0
      const vb = (b[sortKey] as number) ?? 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [filter, sortKey, sortDir])

  console.debug('[AssetTable] filter=', filter, 'sort=', sortKey, sortDir, 'rows=', rows.length)

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        Нет активов в этой категории
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: '0 12px',
          alignItems: 'end',
        }}
      >
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>#</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>Актив</div>
        <HeaderCell label="Цена"          sortKey="price"     activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
        <HeaderCell label="Изм. 24ч"      sortKey="change24h" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
        <HeaderCell label="Объём 24ч"     sortKey="volume24h" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
        <HeaderCell label="Капитализация" sortKey="marketCap" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>График</div>
      </div>

      {/* Data rows */}
      {rows.map((asset, index) => (
        <motion.div
          key={asset.symbol}
          whileHover={{ backgroundColor: 'var(--bg)' }}
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            gap: '0 12px',
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {/* # */}
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
            {index + 1}
          </span>

          {/* Актив */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: asset.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {asset.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                {asset.symbol}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{asset.name}</div>
            </div>
          </div>

          {/* Цена */}
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            {formatPrice(asset.price, asset.type)}
          </div>

          {/* Изм. 24ч */}
          <div style={{ textAlign: 'right' }}>
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

          {/* Объём 24ч */}
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text)' }}>
            {formatBillion(asset.volume24h)}
          </div>

          {/* Капитализация */}
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text)' }}>
            {asset.marketCap ? formatTrillion(asset.marketCap) : '–'}
          </div>

          {/* Sparkline */}
          <SparklineCell symbol={asset.symbol} positive={asset.change24h >= 0} />
        </motion.div>
      ))}
    </div>
  )
}
