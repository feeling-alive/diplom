import { motion } from 'framer-motion'
import { Minus } from 'lucide-react'
import type { DashboardWidget, WidgetType } from '../../types/widgets.types'
import { WIDGET_REGISTRY } from '../../constants/widgets.registry'
import WatchlistPanel from './WatchlistPanel'
import PriceChartWidget from './PriceChartWidget'
import AllocationChart from './AllocationChart'
import CommunityWidget from './CommunityWidget'
import NewsWidget from './NewsWidget'
import PersonalizedPanel from './PersonalizedPanel'
import TopMoversWidget from './widgets/TopMoversWidget'
import ForexRatesWidget from './widgets/ForexRatesWidget'
import FearGreedWidget from './widgets/FearGreedWidget'
import MarketVolumeWidget from './widgets/MarketVolumeWidget'
import TrendingCoinsWidget from './widgets/TrendingCoinsWidget'

function renderWidgetContent(type: WidgetType) {
  switch (type) {
    case 'watchlist': return <WatchlistPanel />
    case 'price_chart': return <PriceChartWidget />
    case 'allocation': return <AllocationChart />
    case 'community': return <CommunityWidget />
    case 'news': return <NewsWidget />
    case 'kpi_portfolio': return <PersonalizedPanel />
    case 'top_movers': return <TopMoversWidget />
    case 'forex_rates': return <ForexRatesWidget />
    case 'fear_greed': return <FearGreedWidget />
    case 'market_volume': return <MarketVolumeWidget />
    case 'trending_coins': return <TrendingCoinsWidget />
    default: return null
  }
}

interface Props {
  widget: DashboardWidget
  isEditMode: boolean
  onRemove: (id: string) => void
}

export default function WidgetCard({ widget, isEditMode, onRemove }: Props) {
  const def = WIDGET_REGISTRY.find((r) => r.type === widget.type)
  const Icon = def?.icon

  return (
    <div
      className="widget-card"
      style={{
        background: 'var(--white)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        border: isEditMode ? '1.5px dashed rgba(225,29,72,0.4)' : '1px solid var(--border)',
        padding: isEditMode ? 20 : 16,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 120,
        transition: 'box-shadow 0.2s, transform 0.2s, outline-color 0.2s, border-color 0.2s',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        opacity: isEditMode ? 0.4 : 1,
        transition: 'opacity 0.2s',
      }}>
        {def && Icon && (
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: `${def.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={13} strokeWidth={2} color={def.color} />
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
          {def?.title ?? widget.type}
        </span>
      </div>

      {/* Widget content */}
      <div style={{
        height: 'calc(100% - 36px)',
        overflow: 'hidden',
      }}>
        {renderWidgetContent(widget.type)}
      </div>

      {/* Remove button in edit mode */}
      {isEditMode && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onRemove(widget.id)}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--red)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            lineHeight: 1,
          }}
        >
          <Minus size={12} strokeWidth={2.5} />
        </motion.button>
      )}

      {/* Resize corner in edit mode */}
      {isEditMode && (
        <div className="widget-resize-corner">
          <div className="resize-dot" />
          <div className="resize-dot" />
          <div className="resize-dot" />
        </div>
      )}
    </div>
  )
}