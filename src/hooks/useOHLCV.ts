import { useQuery } from '@tanstack/react-query'
import type { PricePoint, Timeframe } from '../types/market.types'
import { getMockOHLCV } from '../mock/ohlcv.mock'

// Maps Timeframe to OKX bar parameter string
const OKX_BAR: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1H': '1H',
  '4H': '4H',
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
}

// Maps Timeframe to Finnhub resolution
const FINNHUB_RES: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1H': '60',
  '4H': '240',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
}

async function fetchOKXCandles(symbol: string, timeframe: Timeframe): Promise<PricePoint[]> {
  // TODO: real impl — OKX candles API
  const bar = OKX_BAR[timeframe]
  const res = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${bar}&limit=100`,
  )
  const json = (await res.json()) as { data: Array<[string, string, string, string, string, string, string]> }
  // OKX returns [ts, open, high, low, close, vol, volCcy]
  return json.data.map((row) => ({
    timestamp: parseInt(row[0], 10),
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
  }))
}

async function fetchFinnhubCandles(symbol: string, timeframe: Timeframe): Promise<PricePoint[]> {
  // TODO: real impl — Finnhub candle API
  const resolution = FINNHUB_RES[timeframe]
  const to = Math.floor(Date.now() / 1000)
  const from = to - 100 * 3600 // rough 100-bar window
  const key = (import.meta.env.VITE_FINNHUB_KEY as string | undefined) ?? ''
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`,
  )
  const json = (await res.json()) as {
    t: number[]
    o: number[]
    h: number[]
    l: number[]
    c: number[]
    v: number[]
    s: string
  }
  if (json.s === 'no_data') return []
  return json.t.map((ts, i) => ({
    timestamp: ts * 1000,
    open: json.o[i] ?? 0,
    high: json.h[i] ?? 0,
    low: json.l[i] ?? 0,
    close: json.c[i] ?? 0,
    volume: json.v[i] ?? 0,
  }))
}

interface OHLCVResult {
  data: PricePoint[]
  isLoading: boolean
  error: Error | null
}

export function useOHLCV(symbol: string, timeframe: Timeframe, useMock = true): OHLCVResult {
  const { data, isLoading, error } = useQuery<PricePoint[], Error>({
    queryKey: ['ohlcv', symbol, timeframe, useMock],
    queryFn: async () => {
      if (useMock) {
        console.debug('[useOHLCV]', symbol, timeframe, 'mock mode')
        return getMockOHLCV(symbol)
      }
      // Route to correct data source by symbol format
      const isCrypto = symbol.includes('-')
      const points = isCrypto
        ? await fetchOKXCandles(symbol, timeframe)
        : await fetchFinnhubCandles(symbol, timeframe)
      console.debug('[useOHLCV]', symbol, timeframe, 'points=', points.length)
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
