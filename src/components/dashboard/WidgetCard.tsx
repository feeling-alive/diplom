import { motion } from 'framer-motion'
import { X } from 'lucide-react'
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

export function renderWidgetContent(type: WidgetType, gridW: number, gridH: number) {
  switch (type) {
    case 'watchlist': return <WatchlistPanel gridW={gridW} gridH={gridH} />
    case 'price_chart': return <PriceChartWidget gridW={gridW} gridH={gridH} />
    case 'allocation': return <AllocationChart gridW={gridW} gridH={gridH} />
    case 'community': return <CommunityWidget gridW={gridW} gridH={gridH} />
    case 'news': return <NewsWidget gridW={gridW} gridH={gridH} />
    case 'kpi_portfolio': return <PersonalizedPanel gridW={gridW} gridH={gridH} />
    case 'top_movers': return <TopMoversWidget gridW={gridW} gridH={gridH} />
    case 'forex_rates': return <ForexRatesWidget gridW={gridW} gridH={gridH} />
    case 'fear_greed': return <FearGreedWidget gridW={gridW} gridH={gridH} />
    case 'market_volume': return <MarketVolumeWidget gridW={gridW} gridH={gridH} />
    case 'trending_coins': return <TrendingCoinsWidget gridW={gridW} gridH={gridH} />
    default: return null
  }
}

interface Props {
  widget: DashboardWidget
  onRemove: (id: string) => void
}

export default function WidgetCard({ widget, onRemove }: Props) {
  const def = WIDGET_REGISTRY.find((r) => r.type === widget.type)
  const Icon = def?.icon

  console.debug('[WidgetCard] %s rendered at %dx%d', widget.type, widget.w, widget.h)

  return (
    <div
      className="widget-card"
      style={{
        background: 'var(--white)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
        padding: 16,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — drag handle: only this strip starts a drag */}
      <div
        className="widget-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
          flexShrink: 0,
          minWidth: 0,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {def && Icon && (
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: `${def.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={13} strokeWidth={2} color={def.color} />
          </div>
        )}
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {def?.title ?? widget.type}
        </span>
      </div>

      {/* Widget content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {renderWidgetContent(widget.type, widget.w, widget.h)}
      </div>

      {/* Remove button — visible on widget hover */}
      <motion.button
        className="widget-remove-btn"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation()
          onRemove(widget.id)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Удалить виджет"
        title="Удалить виджет"
      >
        <X size={12} strokeWidth={2.5} />
      </motion.button>
    </div>
  )
}
