import { useState, useEffect, useRef, useMemo } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import { ENV, USE_MOCK } from '../lib/env'

interface AssetPriceResult {
  price: number
  change24h: number
  isLoading: boolean
  isConnected: boolean
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

  const [price, setPrice] = useState(0)
  const [change24h, setChange24h] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (useMock) return

    if (type === 'crypto') {
      const ws = new WebSocket(ENV.OKX_WS_URL)
      wsRef.current = ws

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
            setPrice(Number.isFinite(newPrice) ? newPrice : 0)
            setChange24h(newChange)
            setIsLoading(false)
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
    }

    if (type === 'stock') {
      const fetchQuote = async () => {
        try {
          const res = await fetch(`/api/quotes/stock/${symbol}`, { signal: AbortSignal.timeout(4000) })
          if (!res.ok) throw new Error(`quotes/stock ${res.status}`)
          const json = (await res.json()) as { price: number; changePercent: number }
          const safePrice = Number.isFinite(json.price) ? json.price : 0
          const safeChange = Number.isFinite(json.changePercent) ? json.changePercent : 0
          setPrice(safePrice)
          setChange24h(safeChange)
          setIsLoading(false)
          console.info('[useAssetPrice] %s backend price=%s change=%s', symbol, safePrice, safeChange)
        } catch (err) {
          console.warn('[useAssetPrice] backend fetch failed for %s:', symbol, err)
        }
      }

      void fetchQuote()
      intervalRef.current = setInterval(() => void fetchQuote(), 60_000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    if (type === 'forex') {
      const [base, quote] = symbol.replace('-', '/').split('/')
      const fetchRate = async () => {
        try {
          const res = await fetch(`/api/quotes/forex/${base}/${quote}`)
          if (!res.ok) throw new Error(`quotes/forex ${res.status}`)
          const json = (await res.json()) as { rate: number }
          setPrice(json.rate)
          setIsLoading(false)
          console.debug('[useAssetPrice] %s backend rate=%s', symbol, json.rate)
        } catch (err) {
          console.warn('[useAssetPrice] backend forex fetch error:', err)
        }
      }

      void fetchRate()
      intervalRef.current = setInterval(() => void fetchRate(), 60_000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
  }, [symbol, type, useMock])

  if (useMock) return mockResult
  return { price, change24h, isLoading, isConnected }
}
