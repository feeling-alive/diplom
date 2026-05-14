import { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Asset } from '../../types/market.types'
import { useCoinInfo } from '../../hooks/useCoinInfo'

interface Props {
  asset: Asset
}

interface MetricItem {
  label: string
  value: string
}

function formatBillion(n: number | null): string {
  if (n === null || n === undefined) return '–'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(0)}`
}

function formatPrice(p: number | null | undefined): string {
  if (p === null || p === undefined) return '–'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  return `$${p.toFixed(4)}`
}

export default function MetricsBar({ asset }: Props) {
  const { data: coinInfo } = useCoinInfo(asset.symbol)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const spread = asset.high24h && asset.low24h
    ? `${(((asset.high24h - asset.low24h) / asset.low24h) * 100).toFixed(2)}%`
    : '–'

  const metrics: MetricItem[] = [
    { label: 'Капитализация', value: formatBillion(asset.marketCap ?? coinInfo?.ath ?? null) },
    { label: 'Объём 24ч',      value: formatBillion(asset.volume24h) },
    { label: 'Максимум 24ч',   value: formatPrice(asset.high24h) },
    { label: 'Минимум 24ч',    value: formatPrice(asset.low24h) },
    { label: 'Спред 24ч',      value: spread },
    { label: 'В обращении',    value: coinInfo?.circulatingSupply ? `${(coinInfo.circulatingSupply / 1e6).toFixed(1)}M` : '–' },
    { label: 'Рейтинг',        value: coinInfo?.marketCapRank ? `#${coinInfo.marketCapRank}` : '–' },
    { label: 'ATH',            value: formatPrice(coinInfo?.ath ?? null) },
  ]

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setCanScrollLeft(left)
    setCanScrollRight(right)
    console.debug('[MetricsBar] canL=%s canR=%s scrollLeft=%d', left, right, el.scrollLeft)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollerRef.current
    if (!el) return
    if (el.scrollWidth <= el.clientWidth) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  function scrollByPx(px: number) {
    scrollerRef.current?.scrollBy({ left: px, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative', marginTop: 16 }}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollByPx(-200)}
          style={{
            position: 'absolute',
            left: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <ChevronLeft size={14} color="var(--ink)" />
        </button>
      )}

      {/* Scroller */}
      <div
        ref={scrollerRef}
        onWheel={handleWheel}
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '2px 4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="metrics-bar-scroller"
      >
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            style={{
              flexShrink: 0,
              minWidth: 140,
              padding: '12px 16px',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              {m.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollByPx(200)}
          style={{
            position: 'absolute',
            right: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <ChevronRight size={14} color="var(--ink)" />
        </button>
      )}
    </div>
  )
}
