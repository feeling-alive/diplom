import { useState } from 'react'
import { motion } from 'framer-motion'
import MarketSummaryBar from '../components/market-overview/MarketSummaryBar'
import TopMovers from '../components/market-overview/TopMovers'
import AssetTable from '../components/market-overview/AssetTable'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex'

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'crypto', label: 'Крипто' },
  { key: 'stock', label: 'Акции' },
  { key: 'forex', label: 'Форекс' },
]

const today = new Date().toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function MarketOverview() {
  const [filter, setFilter] = useState<FilterType>('all')

  console.debug('[MarketOverview] rendered, filter=', filter)

  return (
    <div className="main-content" style={{ flex: 1 }}>
      <motion.div
        className="main-scroll"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ padding: '20px 24px 24px' }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Обзор рынка
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 0 }}>
            Актуальные данные · {today}
          </p>
        </div>

        {/* Global market stats */}
        <MarketSummaryBar />

        {/* Asset type filter tabs */}
        <div style={{ display: 'flex', gap: 6, margin: '0 0 14px', flexWrap: 'wrap' }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                console.debug('[MarketOverview] filter changed=', tab.key)
                setFilter(tab.key)
              }}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--r-pill)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                background: filter === tab.key ? 'var(--ink)' : 'var(--bg)',
                color: filter === tab.key ? '#fff' : 'var(--muted)',
                border: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top movers section */}
        <div style={{ marginBottom: 14 }}>
          <TopMovers filter={filter} />
        </div>

        {/* Asset table */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <AssetTable filter={filter} />
        </div>
      </motion.div>
    </div>
  )
}
