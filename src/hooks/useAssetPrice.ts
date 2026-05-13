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
            const newChange = parseFloat(ticker.changeRate24h) * 100
            setPrice(newPrice)
            setChange24h(newChange)
            setIsLoading(false)
            console.debug('[useAssetPrice] %s WS price=%s', symbol, newPrice)
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
      if (!ENV.FINNHUB_API_KEY) return
      const fetchQuote = async () => {
        try {
          const res = await fetch(
            `${ENV.FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${ENV.FINNHUB_API_KEY}`,
          )
          if (!res.ok) throw new Error(`Finnhub ${res.status}`)
          const json = (await res.json()) as { c: number; dp: number }
          setPrice(json.c)
          setChange24h(json.dp)
          setIsLoading(false)
          console.info('[useAssetPrice] %s Finnhub price=%s', symbol, json.c)
        } catch (err) {
          console.warn('[useAssetPrice] Finnhub fetch failed for %s:', symbol, err)
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
          const res = await fetch(
            `${ENV.FRANKFURTER_BASE_URL}/latest?from=${base}&to=${quote}`,
          )
          const json = (await res.json()) as { rates: Record<string, number> }
          const rate = json.rates[quote ?? '']
          if (rate !== undefined) {
            setPrice(rate)
            setIsLoading(false)
            console.debug('[useAssetPrice] %s frankfurter rate=%s', symbol, rate)
          }
        } catch (err) {
          console.warn('[useAssetPrice] frankfurter fetch error:', err)
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
