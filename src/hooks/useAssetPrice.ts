import { useState, useEffect, useRef, useMemo } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'

interface AssetPriceResult {
  price: number
  change24h: number
  isLoading: boolean
  isConnected: boolean
}

export function useAssetPrice(
  symbol: string,
  type: Asset['type'],
  useMock = true,
): AssetPriceResult {
  // Mock values derived synchronously — no effect needed for static data
  const mockResult = useMemo<AssetPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol)
    if (!asset) {
      console.debug('[useAssetPrice] symbol not found in mock:', symbol)
    } else {
      console.debug('[useAssetPrice]', symbol, 'mock=true price=', asset.price)
    }
    return {
      price: asset?.price ?? 0,
      change24h: asset?.change24h ?? 0,
      isLoading: false,
      isConnected: false,
    }
  }, [symbol])

  // Live state — only updated by the real-data effect below
  const [price, setPrice] = useState(0)
  const [change24h, setChange24h] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  // Stable refs to avoid stale closures in WebSocket/interval callbacks
  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (useMock) return // mock values are derived above — no live effect needed

    // Real implementation stubs — wired up when VITE_* env keys are provided
    if (type === 'crypto') {
      // TODO: real impl — OKX WebSocket
      const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public')
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: symbol }] }))
        console.debug('[useAssetPrice] WS connected for', symbol)
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
            console.debug('[useAssetPrice]', symbol, 'WS price=', newPrice)
          }
        } catch {
          // malformed frame — ignore
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        console.debug('[useAssetPrice] WS closed for', symbol)
      }

      return () => {
        ws.close()
        wsRef.current = null
      }
    }

    if (type === 'stock') {
      // TODO: real impl — Finnhub polling every 30s
      const fetchQuote = async () => {
        try {
          const key = import.meta.env.VITE_FINNHUB_KEY as string | undefined
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key ?? ''}`,
          )
          const json = (await res.json()) as { c: number; dp: number }
          setPrice(json.c)
          setChange24h(json.dp)
          setIsLoading(false)
          console.debug('[useAssetPrice]', symbol, 'Finnhub price=', json.c)
        } catch (err) {
          console.error('[useAssetPrice] Finnhub fetch error:', err)
        }
      }

      void fetchQuote()
      intervalRef.current = setInterval(() => void fetchQuote(), 30_000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    if (type === 'forex') {
      // TODO: real impl — frankfurter.app polling every 60s
      const [base, quote] = symbol.replace('-', '/').split('/')
      const fetchRate = async () => {
        try {
          const res = await fetch(
            `https://api.frankfurter.app/latest?from=${base}&to=${quote}`,
          )
          const json = (await res.json()) as { rates: Record<string, number> }
          const rate = json.rates[quote ?? '']
          if (rate !== undefined) {
            setPrice(rate)
            setIsLoading(false)
            console.debug('[useAssetPrice]', symbol, 'frankfurter rate=', rate)
          }
        } catch (err) {
          console.error('[useAssetPrice] frankfurter fetch error:', err)
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
