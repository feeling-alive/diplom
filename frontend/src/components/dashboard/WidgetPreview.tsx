import type { WidgetType } from '../../types/widgets.types'
import { renderWidgetContent } from './WidgetCard'

interface Props {
  type: WidgetType
  gridW?: number
  gridH?: number
}

// [FIX] Modal previews need a concrete height so widgets that use
// ResponsiveContainer (charts, pies) actually render. Pure flex/100% inside
// a height:auto parent collapses Recharts to 0 px.
const PREVIEW_HEIGHTS: Record<string, number> = {
  market_ticker: 110,
  watchlist: 220,
  price_chart: 180,
  allocation: 200,
  news: 200,
  top_movers: 200,
  forex_rates: 200,
  fear_greed: 170,
  market_volume: 110,
  trending_coins: 200,
}

export default function WidgetPreview({ type, gridW = 2, gridH = 2 }: Props) {
  const previewHeight = PREVIEW_HEIGHTS[type] ?? 180

  return (
    <div
      style={{
        background: 'var(--white)',
        padding: 12,
        height: previewHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      {renderWidgetContent(type, gridW, gridH)}
    </div>
  )
}
