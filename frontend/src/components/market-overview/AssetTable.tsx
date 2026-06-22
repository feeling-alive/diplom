import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePrices } from '../../hooks/usePrices'
import { useOHLCV } from '../../hooks/useOHLCV'
import { EmptySearchState } from '../ui/EmptySearchState'
import type { Asset } from '../../types/market.types'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex'
type SortKey = 'price' | 'change24h' | 'volume24h' | 'marketCap'
type SortDir = 'asc' | 'desc'

interface Props {
  filter: FilterType
  searchQuery?: string
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
  // Single source of truth: the same /api/quotes/ohlcv hook the asset page chart uses,
  // so the sparkline and SimpleChart never disagree (bug #7). React Query caches per
  // [symbol, '1D'], so opening the asset page reuses this exact series.
  const { data } = useOHLCV(symbol, '1D')
  const points = useMemo(() => data.slice(-30).map((p) => p.close), [data])
  const color = positive ? 'var(--green)' : 'var(--accent)'

  // Empty state: no data (e.g. stock upstream returned an empty set) → flat baseline,
  // never a misleading mock shape.
  if (points.length < 2) {
    return <svg width={60} height={30} viewBox="0 0 60 30" style={{ display: 'block' }} aria-hidden />
  }

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
        display: 'flex', alignItems: 'center', gap: 3,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        fontSize: 10, color: isActive ? 'var(--ink)' : 'var(--muted)',
        fontWeight: 500, cursor: sortKey ? 'pointer' : 'default',
        userSelect: 'none', padding: '0 0 10px',
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

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: GRID,
        gap: '0 12px', padding: '10px 0',
        borderBottom: '1px solid var(--border)', alignItems: 'center',
      }}
    >
      <div style={{ height: 12, width: 16, borderRadius: 4, background: 'var(--border)', opacity: 0.6 - index * 0.1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--border)', flexShrink: 0, opacity: 0.5 }} />
        <div>
          <div style={{ height: 12, width: 60, borderRadius: 4, background: 'var(--border)', marginBottom: 4, opacity: 0.5 }} />
          <div style={{ height: 10, width: 80, borderRadius: 4, background: 'var(--border)', opacity: 0.3 }} />
        </div>
      </div>
      {[80, 50, 70, 65, 60].map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ height: 12, width: w, borderRadius: 4, background: 'var(--border)', opacity: 0.4 }} />
        </div>
      ))}
    </div>
  )
}

export default function AssetTable({ filter, searchQuery = '' }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const navigate = useNavigate()
  const { all, cryptos, stocks, forex, isLoading } = usePrices()

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const pool = filter === 'all' ? all
    : filter === 'crypto' ? cryptos
    : filter === 'stock' ? stocks
    : forex

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? pool.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      : pool
    return [...filtered].sort((a, b) => {
      const va = (a[sortKey] as number) ?? 0
      const vb = (b[sortKey] as number) ?? 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [pool, sortKey, sortDir, searchQuery])

  console.debug('[AssetTable] filter=%s search=%s → %d/%d rows isLoading=%s', filter, searchQuery, rows.length, pool.length, isLoading)

  function handleRowClick(symbol: string) {
    console.debug('[AssetTable] row clicked, symbol=', symbol)
    navigate(`/asset/${symbol}`)
  }

  const headerRow = (
    <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '0 12px', alignItems: 'end' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>#</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>Актив</div>
      <HeaderCell label="Цена"          sortKey="price"     activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
      <HeaderCell label="Изм. 24ч"      sortKey="change24h" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
      <HeaderCell label="Объём 24ч"     sortKey="volume24h" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
      <HeaderCell label="Капитализация" sortKey="marketCap" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '0 0 10px', borderBottom: '1px solid var(--border)' }}>График</div>
    </div>
  )

  if (isLoading) {
    return (
      <div>
        {headerRow}
        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} index={i} />)}
      </div>
    )
  }

  if (rows.length === 0) {
    return searchQuery ? (
      <EmptySearchState message="По запросу ничего не найдено" />
    ) : (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
        Нет активов в этой категории
      </div>
    )
  }

  return (
    <div>
      {headerRow}

      {rows.map((asset, index) => (
        <motion.div
          key={asset.symbol}
          whileHover={{ backgroundColor: 'var(--bg)' }}
          onClick={() => handleRowClick(asset.symbol)}
          style={{
            display: 'grid', gridTemplateColumns: GRID,
            gap: '0 12px', padding: '10px 0',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
            {index + 1}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: asset.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
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

          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            {formatPrice(asset.price, asset.type)}
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              className="badge"
              style={{
                background: asset.change24h >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)',
                color: asset.change24h >= 0 ? 'var(--pos)' : 'var(--neg)',
              }}
            >
              {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
            </span>
          </div>

          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text)' }}>
            {formatBillion(asset.volume24h)}
          </div>

          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text)' }}>
            {asset.marketCap ? formatTrillion(asset.marketCap) : '–'}
          </div>

          <SparklineCell symbol={asset.symbol} positive={asset.change24h >= 0} />
        </motion.div>
      ))}
    </div>
  )
}
