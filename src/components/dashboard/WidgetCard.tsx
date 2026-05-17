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
import MarketTicker from './MarketTicker'
import TopMoversWidget from './widgets/TopMoversWidget'
import ForexRatesWidget from './widgets/ForexRatesWidget'
import FearGreedWidget from './widgets/FearGreedWidget'
import MarketVolumeWidget from './widgets/MarketVolumeWidget'
import TrendingCoinsWidget from './widgets/TrendingCoinsWidget'
import TechnicalAnalysisWidget from './widgets/TechnicalAnalysisWidget'
import EconomicCalendarWidget from './widgets/EconomicCalendarWidget'
import HeatmapWidget from './widgets/HeatmapWidget'
import PortfolioPnlWidget from './widgets/PortfolioPnlWidget'
import DominanceChartWidget from './widgets/DominanceChartWidget'
import PriceAlertsWidget from './widgets/PriceAlertsWidget'
import MacdWidget from './widgets/MacdWidget'
import RsiGaugeWidget from './widgets/RsiGaugeWidget'
import OrderBookWidget from './widgets/OrderBookWidget'
import GlobalMarketCapWidget from './widgets/GlobalMarketCapWidget'
import FundingRateWidget from './widgets/FundingRateWidget'
import GasTrackerWidget from './widgets/GasTrackerWidget'
import CurrencyConverterWidget from './widgets/CurrencyConverterWidget'
import WhaleTrackerWidget from './widgets/WhaleTrackerWidget'
import StockScreenerWidget from './widgets/StockScreenerWidget'
import SentimentMeterWidget from './widgets/SentimentMeterWidget'
import LiquidationsWidget from './widgets/LiquidationsWidget'
import YieldCurveWidget from './widgets/YieldCurveWidget'
import CorrelationMatrixWidget from './widgets/CorrelationMatrixWidget'
import AiSignalWidget from './widgets/AiSignalWidget'

export function renderWidgetContent(type: WidgetType, gridW: number, gridH: number) {
  switch (type) {
    case 'watchlist': return <WatchlistPanel gridW={gridW} gridH={gridH} />
    case 'price_chart': return <PriceChartWidget gridW={gridW} gridH={gridH} />
    case 'allocation': return <AllocationChart gridW={gridW} gridH={gridH} />
    case 'community': return <CommunityWidget gridW={gridW} gridH={gridH} />
    case 'news': return <NewsWidget gridW={gridW} gridH={gridH} />
    case 'market_ticker': return <MarketTicker gridW={gridW} gridH={gridH} />
    case 'top_movers': return <TopMoversWidget gridW={gridW} gridH={gridH} />
    case 'forex_rates': return <ForexRatesWidget gridW={gridW} gridH={gridH} />
    case 'fear_greed': return <FearGreedWidget gridW={gridW} gridH={gridH} />
    case 'market_volume': return <MarketVolumeWidget gridW={gridW} gridH={gridH} />
    case 'trending_coins': return <TrendingCoinsWidget gridW={gridW} gridH={gridH} />
    case 'technical_analysis': return <TechnicalAnalysisWidget gridW={gridW} gridH={gridH} />
    case 'economic_calendar': return <EconomicCalendarWidget gridW={gridW} gridH={gridH} />
    case 'heatmap': return <HeatmapWidget gridW={gridW} gridH={gridH} />
    case 'portfolio_pnl': return <PortfolioPnlWidget gridW={gridW} gridH={gridH} />
    case 'dominance_chart': return <DominanceChartWidget gridW={gridW} gridH={gridH} />
    case 'price_alerts': return <PriceAlertsWidget gridW={gridW} gridH={gridH} />
    case 'macd_widget': return <MacdWidget gridW={gridW} gridH={gridH} />
    case 'rsi_gauge': return <RsiGaugeWidget gridW={gridW} gridH={gridH} />
    case 'order_book': return <OrderBookWidget gridW={gridW} gridH={gridH} />
    case 'global_market_cap': return <GlobalMarketCapWidget gridW={gridW} gridH={gridH} />
    case 'funding_rate': return <FundingRateWidget gridW={gridW} gridH={gridH} />
    case 'gas_tracker': return <GasTrackerWidget gridW={gridW} gridH={gridH} />
    case 'currency_converter': return <CurrencyConverterWidget gridW={gridW} gridH={gridH} />
    case 'whale_tracker': return <WhaleTrackerWidget gridW={gridW} gridH={gridH} />
    case 'stock_screener': return <StockScreenerWidget gridW={gridW} gridH={gridH} />
    case 'sentiment_meter': return <SentimentMeterWidget gridW={gridW} gridH={gridH} />
    case 'liquidations': return <LiquidationsWidget gridW={gridW} gridH={gridH} />
    case 'yield_curve': return <YieldCurveWidget gridW={gridW} gridH={gridH} />
    case 'correlation_matrix': return <CorrelationMatrixWidget gridW={gridW} gridH={gridH} />
    case 'ai_signal': return <AiSignalWidget gridW={gridW} gridH={gridH} />
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
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
        padding: 10,
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
          gap: 5,
          marginBottom: 6,
          flexShrink: 0,
          minWidth: 0,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {def && Icon && (
          <div style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: `${def.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={11} strokeWidth={2} color={def.color} />
          </div>
        )}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          letterSpacing: 0.1,
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
