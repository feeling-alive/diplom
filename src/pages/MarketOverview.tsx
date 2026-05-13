import { useState } from 'react'
import { motion } from 'framer-motion'
import NavBar from '../components/layout/FinTrackNavBar'
import MarketSummaryBar from '../components/market-overview/MarketSummaryBar'
import TopMovers from '../components/market-overview/TopMovers'
import AssetTable from '../components/market-overview/AssetTable'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex' | 'index'

const FILTER_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: 'all',    label: 'Все',    count: 8 },
  { key: 'crypto', label: 'Крипто', count: 3 },
  { key: 'stock',  label: 'Акции',  count: 2 },
  { key: 'forex',  label: 'Форекс', count: 2 },
  { key: 'index',  label: 'Индексы', count: 1 },
]

const today = new Date().toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function MarketOverview() {
  const [filter, setFilter] = useState<FilterType>('all')

  console.debug('[MarketOverview] mounted, filter=', filter)

  function handleFilter(key: FilterType) {
    console.debug('[MarketOverview] filter changed=', key)
    setFilter(key)
  }

  return (
    <div className="app-page">
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--white)',
          borderRadius: 22,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 22px 22px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          } as React.CSSProperties}
        >
          {/* Shared page navigation */}
          <NavBar />

          {/* Page header */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
              Обзор рынка
            </h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              Актуальные данные · {today}
            </p>
          </div>

          {/* Global market stats */}
          <MarketSummaryBar />

          {/* Asset type filter tabs */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              margin: '0 0 12px',
              flexWrap: 'wrap',
            }}
          >
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleFilter(tab.key)}
                style={{
                  padding: '5px 12px',
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
                <span style={{ marginLeft: 4, opacity: 0.6 }}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Top movers section */}
          <div style={{ marginBottom: 12 }}>
            <TopMovers filter={filter} />
          </div>

          {/* Asset table */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <AssetTable filter={filter} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
