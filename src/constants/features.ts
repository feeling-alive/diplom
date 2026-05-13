// Shared widget types used across Dashboard, AddWidgetModal, etc.

export type WidgetId =
  | 'watchlist'
  | 'priceChart'
  | 'allocation'
  | 'community'
  | 'news'
  | 'heatmap'
  | 'aiChat'
  | 'ticker'
  | 'topMovers'
  | 'fearGreed'
  | 'calendar'
  | 'portfolio'

export type WidgetSize = 'S' | 'M' | 'L' | 'XL'

export interface WidgetDefinition {
  id: WidgetId
  label: string
  icon: string
  description: string
  sizes: WidgetSize[]
}

// Feature flags for incomplete pages
export const FEATURES = {
  assets: false,
  settings: false,
  notifications: false,
} as const