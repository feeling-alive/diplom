import { useState } from 'react'
import { motion } from 'framer-motion'

import DashboardTopBar from '../components/dashboard/DashboardTopBar'
import FloatingAssetCards from '../components/dashboard/FloatingAssetCards'
import PortfolioHero from '../components/dashboard/PortfolioHero'
import KpiStrip from '../components/dashboard/KpiStrip'
import AssetStrip from '../components/dashboard/AssetStrip'
import WatchlistPanel from '../components/dashboard/WatchlistPanel'
import AllocationChart from '../components/dashboard/AllocationChart'
import PersonalizedPanel from '../components/dashboard/PersonalizedPanel'
import PriceChartWidget from '../components/dashboard/PriceChartWidget'
import CommunityWidget from '../components/dashboard/CommunityWidget'
import NewsWidget from '../components/dashboard/NewsWidget'
import AddWidgetModal, { type WidgetId } from '../components/dashboard/AddWidgetModal'

const DEFAULT_WIDGETS: WidgetId[] = [
  'chart',
  'community',
  'news',
  'watchlist',
  'allocation',
  'personalized',
]

export default function Dashboard() {
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(DEFAULT_WIDGETS)

  console.debug('[Dashboard] mounted, widgets=', enabledWidgets)

  const has = (id: WidgetId) => enabledWidgets.includes(id)

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
            // Hide scrollbar
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          } as React.CSSProperties}
        >
          {/* Floating asset cards */}
          <FloatingAssetCards onAddClick={() => setShowAddWidget(true)} />

          {/* TopBar */}
          <DashboardTopBar onAddWidget={() => setShowAddWidget(true)} />

          {/* Portfolio hero */}
          <PortfolioHero />

          {/* 5 KPI cards + button */}
          <KpiStrip />

          {/* Horizontal asset strip */}
          <AssetStrip />

          {/* Three-column section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            {has('watchlist') && <WatchlistPanel />}
            {has('allocation') && <AllocationChart />}
            {has('personalized') && <PersonalizedPanel />}
          </div>

          {/* Bottom: chart + community/news */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 12,
            }}
          >
            {has('chart') && <PriceChartWidget />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {has('community') && <CommunityWidget />}
              {has('news') && <NewsWidget />}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Widget management modal */}
      <AddWidgetModal
        open={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        enabledWidgets={enabledWidgets}
        onApply={setEnabledWidgets}
      />
    </div>
  )
}
