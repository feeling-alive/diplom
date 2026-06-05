import { useQuery } from '@tanstack/react-query'
import type { PricePoint, Timeframe } from '../types/market.types'
import { getMockOHLCV } from '../mock/ohlcv.mock'
import { USE_MOCK } from '../lib/env'

// Phase 3 миграция: useOHLCV ходит в бэкенд /api/quotes/ohlcv/{symbol} через vite-proxy
// (см. .ai-factory/plans/widgets-redis-cleanup.md, Task 3.1). Vite уже настроен
// (frontend/vite.config.ts: '/api/quotes' → http://localhost:8000).
//
// Symbol routing (crypto vs stock) делает бэкенд: BTC-USDT → OKX, AAPL → Finnhub.
// Здесь остаётся только маппинг таймфреймов на строковые ключи query-параметра —
// они совпадают с OKX/Finnhub, отдельной карты не нужно.

interface OHLCVBackendResponse {
  symbol: string
  timeframe: string
  candles: Array<{
    t: number       // unix milliseconds (бэкенд нормализует для OKX и Finnhub)
    o: number
    h: number
    l: number
    c: number
    v: number
  }>
  source: 'okx' | 'finnhub' | 'cache' | 'mock'
}

interface OHLCVResult {
  data: PricePoint[]
  isLoading: boolean
  error: Error | null
}

export function useOHLCV(symbol: string, timeframe: Timeframe, useMock = USE_MOCK): OHLCVResult {
  const { data, isLoading, error } = useQuery<PricePoint[], Error>({
    queryKey: ['ohlcv', symbol, timeframe, useMock],
    queryFn: async () => {
      if (useMock) {
        console.debug('[useOHLCV] %s %s mock mode', symbol, timeframe)
        return getMockOHLCV(symbol)
      }
      const url = `/api/quotes/ohlcv/${encodeURIComponent(symbol)}?tf=${timeframe}&limit=100`
      console.debug('[useOHLCV] fetch %s %s', symbol, timeframe)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`quotes/ohlcv ${res.status}`)
      const json = (await res.json()) as OHLCVBackendResponse
      const points: PricePoint[] = json.candles.map((c) => ({
        timestamp: c.t,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
        volume: c.v,
      }))
      console.debug('[useOHLCV] %s %s -> %d candles (source=%s)', symbol, timeframe, points.length, json.source)
      return points
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  return {
    data: data ?? [],
    isLoading,
    error: error ?? null,
  }
}
