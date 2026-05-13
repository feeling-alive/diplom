import { useState, useEffect, useMemo } from 'react'
import { MOCK_PRICES } from '../mock/prices.mock'

interface StockPriceResult {
  price: number
  change: number
  isLoading: boolean
}

export function useStockPrice(symbol: string, useMock = true): StockPriceResult {
  // Mock values derived synchronously — no effect needed for static data
  const mockResult = useMemo<StockPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'stock')
    console.debug('[useStockPrice]', symbol, 'mock price=', asset?.price ?? 0)
    return { price: asset?.price ?? 0, change: asset?.change24h ?? 0, isLoading: false }
  }, [symbol])

  const [price, setPrice] = useState(0)
  const [change, setChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (useMock) return

    // TODO: real impl — GET https://finnhub.io/api/v1/quote
    const fetchQuote = async () => {
      try {
        const key = (import.meta.env.VITE_FINNHUB_KEY as string | undefined) ?? ''
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
        )
        const json = (await res.json()) as { c: number; dp: number }
        setPrice(json.c)
        setChange(json.dp)
        setIsLoading(false)
        console.debug('[useStockPrice]', symbol, 'Finnhub price=', json.c)
      } catch (err) {
        console.error('[useStockPrice] fetch error:', err)
      }
    }

    void fetchQuote()
  }, [symbol, useMock])

  if (useMock) return mockResult
  return { price, change, isLoading }
}
