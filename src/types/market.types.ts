export interface Asset {
  symbol: string        // e.g. 'BTC-USDT' | 'ETH-USDT' | 'AAPL' | 'EUR-USD'
  name: string          // e.g. 'Bitcoin'
  type: 'crypto' | 'stock' | 'forex' | 'index'
  price: number
  change24h: number     // percent change over 24h
  changeDollar: number  // dollar change
  volume24h: number
  marketCap?: number
  high24h: number
  low24h: number
  color: string         // avatar/icon background color, e.g. '#F7931A'
  icon?: string         // initial letter for avatar, e.g. 'B' | 'E' | 'A'
}

export interface PricePoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relatedAssets: string[]
  imageUrl?: string
}

export interface CommunityPost {
  id: string
  author: {
    name: string
    handle: string
    initials: string
    avatarColor: string
  }
  content: string
  relatedAsset: string
  assetColor: string
  likes: number
  comments: number
  createdAt: string
  isLiked: boolean
}

export interface WatchlistItem {
  symbol: string
  addedAt: string
  viewCount: number   // incremented each time the asset page is opened — used for personalization ranking
}

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'
