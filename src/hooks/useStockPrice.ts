import { useState, useEffect, useMemo } from 'react'
import { MOCK_PRICES } from '../mock/prices.mock'
import { ENV, USE_MOCK } from '../lib/env'

interface StockPriceResult {
  price: number
  change: number
  isLoading: boolean
}

export function useStockPrice(symbol: string, useMock = USE_MOCK): StockPriceResult {
  const mockResult = useMemo<StockPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'stock')
    console.debug('[useStockPrice] %s mock price=%s', symbol, asset?.price ?? 0)
    return { price: asset?.price ?? 0, change: asset?.change24h ?? 0, isLoading: false }
  }, [symbol])

  const [price, setPrice] = useState(0)
  const [change, setChange] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (useMock || !ENV.FINNHUB_API_KEY) return

    const fetchQuote = async () => {
      try {
        const res = await fetch(
          `${ENV.FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${ENV.FINNHUB_API_KEY}`,
        )
        if (!res.ok) throw new Error(`Finnhub ${res.status}`)
        const json = (await res.json()) as { c: number; dp: number }
        setPrice(json.c)
        setChange(json.dp)
        setIsLoading(false)
        console.info('[useStockPrice] %s Finnhub price=%s', symbol, json.c)
      } catch (err) {
        console.warn('[useStockPrice] fetch failed for %s:', symbol, err)
      }
    }

    void fetchQuote()
    const id = setInterval(() => void fetchQuote(), 60_000)
    return () => clearInterval(id)
  }, [symbol, useMock])

  if (useMock || !ENV.FINNHUB_API_KEY) return mockResult
  return { price, change, isLoading }
}
