import type { LucideIcon } from 'lucide-react'

export type WidgetType =
  | 'watchlist'
  | 'price_chart'
  | 'allocation'
  | 'community'
  | 'news'
  | 'market_ticker'
  | 'top_movers'
  | 'forex_rates'
  | 'fear_greed'
  | 'market_volume'
  | 'trending_coins'
  | 'technical_analysis'
  | 'economic_calendar'
  | 'heatmap'
  | 'portfolio_pnl'
  | 'dominance_chart'
  | 'price_alerts'
  | 'macd_widget'
  | 'rsi_gauge'
  | 'order_book'
  | 'global_market_cap'
  | 'funding_rate'
  | 'gas_tracker'
  | 'currency_converter'
  | 'whale_tracker'
  | 'stock_screener'
  | 'sentiment_meter'
  | 'liquidations'
  | 'yield_curve'
  | 'correlation_matrix'
  | 'ai_signal';

export type WidgetSize = {
  w: number;
  h: number;
  label: string;
};

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  availableSizes: WidgetSize[];
  defaultSize: WidgetSize;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
}

export interface DashboardWidget {
  id: string;              // уникальный id (uuid)
  type: WidgetType;
  size: WidgetSize;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetSizeProps {
  gridW?: number;
  gridH?: number;
}