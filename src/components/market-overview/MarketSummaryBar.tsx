import { motion } from 'framer-motion'
import { MOCK_PRICES } from '../../mock/prices.mock'

interface StatCard {
  label: string
  value: string
  change?: string
  changePositive?: boolean
}

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

const totalCap  = MOCK_PRICES.reduce((s, a) => s + (a.marketCap ?? 0), 0)
const totalVol  = MOCK_PRICES.reduce((s, a) => s + a.volume24h, 0)
const btc       = MOCK_PRICES.find(a => a.symbol === 'BTC-USDT')
const btcDom    = btc?.marketCap ? ((btc.marketCap / totalCap) * 100).toFixed(1) : '–'
const activeCount = MOCK_PRICES.length

const STATS: StatCard[] = [
  { label: 'Капитализация рынка', value: formatTrillion(totalCap), change: '+2.1%', changePositive: true },
  { label: 'Объём 24ч',           value: formatBillion(totalVol),  change: '+4.3%', changePositive: true },
  { label: 'BTC Доминирование',   value: `${btcDom}%`,             change: '+0.3%', changePositive: true },
  { label: 'Активов в списке',    value: String(activeCount) },
]

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function MarketSummaryBar() {
  console.debug('[MarketSummaryBar] totalCap=', totalCap, 'btcDom=', btcDom)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}
    >
      {STATS.map((stat) => (
        <motion.div
          key={stat.label}
          variants={item}
          className="card"
          style={{ padding: '14px 16px' }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--ink)',
              marginBottom: stat.change ? 6 : 0,
            }}
          >
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
