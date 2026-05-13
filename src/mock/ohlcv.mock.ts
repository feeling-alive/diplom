import type { PricePoint } from '../types/market.types'
import { MOCK_PRICES } from './prices.mock'

// Generates realistic OHLCV candles via a random-walk starting from the asset's current price.
// Each candle represents 1 hour going backwards from now.
export function getMockOHLCV(symbol: string, count = 100): PricePoint[] {
  const asset = MOCK_PRICES.find((a) => a.symbol === symbol)
  const basePrice = asset ? asset.price : 100

  const candles: PricePoint[] = []
  const now = Date.now()
  const hourMs = 60 * 60 * 1000

  let prevClose = basePrice

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * hourMs

    // Random walk: ±1.5% per candle
    const changePercent = (Math.random() - 0.5) * 0.03
    const open = prevClose
    const close = open * (1 + changePercent)

    // High/low extend slightly beyond open/close
    const spread = Math.abs(close - open) * (1 + Math.random() * 0.5)
    const high = Math.max(open, close) + spread * Math.random()
    const low = Math.min(open, close) - spread * Math.random()

    // Volume: random between 50M and 500M, scaled by asset price tier
    const volumeBase = basePrice > 10000 ? 5_000_000 : basePrice > 100 ? 500_000 : 50_000
    const volume = volumeBase + Math.random() * volumeBase * 9

    candles.push({
      timestamp,
      open: +open.toFixed(6),
      high: +high.toFixed(6),
      low: +low.toFixed(6),
      close: +close.toFixed(6),
      volume: +volume.toFixed(2),
    })

    prevClose = close
  }

  return candles
}
