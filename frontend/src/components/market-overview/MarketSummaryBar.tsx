import { motion } from 'framer-motion'
import { usePrices } from '../../hooks/usePrices'

function formatTrillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}

function formatBillion(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toFixed(0)}`
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ height: 10, width: '60%', borderRadius: 6, background: 'var(--border)', marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 22, width: '80%', borderRadius: 6, background: 'var(--border)', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 16, width: '40%', borderRadius: 6, background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

export default function MarketSummaryBar() {
  const { all, isLoading } = usePrices()

  const totalCap  = all.reduce((s, a) => s + (a.marketCap ?? 0), 0)
  const totalVol  = all.reduce((s, a) => s + a.volume24h, 0)
  const btc       = all.find(a => a.symbol === 'BTC-USDT')
  const btcDom    = btc?.marketCap && totalCap > 0 ? ((btc.marketCap / totalCap) * 100).toFixed(1) : '–'
  const activeCount = all.length

  console.debug('[MarketSummaryBar] prices updated, totalCap=', totalCap, 'btcDom=', btcDom, 'isLoading=', isLoading)

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const STATS = [
    { label: 'Капитализация рынка', value: formatTrillion(totalCap), change: '+2.1%', changePositive: true },
    { label: 'Объём 24ч',           value: formatBillion(totalVol),  change: '+4.3%', changePositive: true },
    { label: 'BTC Доминирование',   value: `${btcDom}%`,             change: '+0.3%', changePositive: true },
    { label: 'Активов в списке',    value: String(activeCount) },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}
    >
      {STATS.map((stat) => (
        <motion.div key={stat.label} variants={item} className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>
            {stat.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: stat.change ? 6 : 0 }}>
            {stat.value}
          </div>
          {stat.change && (
            <span
              className="badge"
              style={{
                background: stat.changePositive ? '#E8F8EF' : 'var(--accent-bg)',
                color: stat.changePositive ? 'var(--green)' : 'var(--accent)',
              }}
            >
              {stat.change}
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}
