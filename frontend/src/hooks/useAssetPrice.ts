import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import INITIAL_PRICES from '../data/prices.json'
import { ENV, USE_MOCK } from '../lib/env'

interface AssetPriceResult {
  price: number
  change24h: number
  isLoading: boolean
  isConnected: boolean
}

// Fetch a single non-crypto quote. Pure (no component state) so TanStack Query can
// cache it per (type, symbol) — Задача 2: повторный заход на актив не грузит заново.
async function fetchQuote(symbol: string, type: Asset['type']): Promise<{ price: number; change24h: number }> {
  if (type === 'index') {
    // [Задача 3] Индексы не отдаются бесплатным Finnhub — берём стабильный снимок из
    // data/prices.json, не обращаясь к /api/quotes/stock (иначе вернулся бы мусор/0).
    const snap = (INITIAL_PRICES as Asset[]).find((a) => a.symbol === symbol)
    console.warn('[useAssetPrice] index %s: живого источника нет, снимок=%s', symbol, snap?.price)
    return { price: snap?.price ?? 0, change24h: snap?.change24h ?? 0 }
  }
  if (type === 'forex') {
    const [base, quote] = symbol.replace('-', '/').split('/')
    const res = await fetch(`/api/quotes/forex/${base}/${quote}`)
    if (!res.ok) throw new Error(`quotes/forex ${res.status}`)
    const json = (await res.json()) as { rate: number }
    console.debug('[useAssetPrice] %s backend rate=%s', symbol, json.rate)
    return { price: json.rate, change24h: 0 }
  }
  // stock
  const res = await fetch(`/api/quotes/stock/${symbol}`, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`quotes/stock ${res.status}`)
  const json = (await res.json()) as { price: number; changePercent: number }
  const safePrice = Number.isFinite(json.price) ? json.price : 0
  const safeChange = Number.isFinite(json.changePercent) ? json.changePercent : 0
  console.info('[useAssetPrice] %s backend price=%s change=%s', symbol, safePrice, safeChange)
  return { price: safePrice, change24h: safeChange }
}

export function useAssetPrice(
  symbol: string,
  type: Asset['type'],
  useMock = USE_MOCK,
): AssetPriceResult {
  const mockResult = useMemo<AssetPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol)
    if (!asset) {
      console.debug('[useAssetPrice] symbol not found in mock:', symbol)
    } else {
      console.debug('[useAssetPrice] %s mock=true price=%s', symbol, asset.price)
    }
    return {
      price: asset?.price ?? 0,
      change24h: asset?.change24h ?? 0,
      isLoading: false,
      isConnected: false,
    }
  }, [symbol])

  // Crypto streams over WebSocket (live ticks) — kept in component state, not cached.
  const isCrypto = type === 'crypto'
  const [wsPrice, setWsPrice] = useState(0)
  const [wsChange, setWsChange] = useState(0)
  const [wsLoading, setWsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Non-crypto (stock/forex/index) quotes go through the cached query.
  const query = useQuery({
    queryKey: ['assetPrice', type, symbol],
    enabled: !useMock && !isCrypto && !!symbol,
    refetchInterval: type === 'index' ? false : 60_000,
    refetchOnMount: false,
    queryFn: () => fetchQuote(symbol, type),
  })

  useEffect(() => {
    if (useMock || !isCrypto) return

    const ws = new WebSocket(ENV.OKX_WS_URL)
    wsRef.current = ws
    setWsLoading(true)

    ws.onopen = () => {
      setIsConnected(true)
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: symbol }] }))
      console.info('[useAssetPrice] WS connected for %s', symbol)
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          data?: Array<{ last: string; changeRate24h: string }>
        }
        const ticker = msg.data?.[0]
        if (ticker) {
          const newPrice = parseFloat(ticker.last)
          const rawChange = parseFloat(ticker.changeRate24h) * 100
          const newChange = Number.isFinite(rawChange) ? rawChange : 0
          if (!Number.isFinite(rawChange)) {
            console.warn('[useAssetPrice] non-finite change24h from OKX for %s, defaulting to 0', symbol)
          }
          setWsPrice(Number.isFinite(newPrice) ? newPrice : 0)
          setWsChange(newChange)
          setWsLoading(false)
          console.debug('[useAssetPrice] %s WS price=%s change=%s', symbol, newPrice, newChange)
        }
      } catch {
        // malformed frame — ignore
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      console.debug('[useAssetPrice] WS closed for %s', symbol)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [symbol, isCrypto, useMock])

  if (useMock) return mockResult
  if (isCrypto) {
    return { price: wsPrice, change24h: wsChange, isLoading: wsLoading, isConnected }
  }
  return {
    price: query.data?.price ?? 0,
    change24h: query.data?.change24h ?? 0,
    isLoading: query.isLoading,
    isConnected: false,
  }
}
