import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MOCK_PRICES } from '../mock/prices.mock'
import { USE_MOCK } from '../lib/env'

interface StockPriceResult {
  price: number
  change: number
  isLoading: boolean
}

// [Задача 2] Котировка кэшируется в QueryClient по символу, поэтому повторное
// открытие того же актива не уходит в загрузку заново (данные из кэша пока свежи).
export function useStockPrice(symbol: string, useMock = USE_MOCK): StockPriceResult {
  const mockResult = useMemo<StockPriceResult>(() => {
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'stock')
    console.debug('[useStockPrice] %s mock price=%s', symbol, asset?.price ?? 0)
    return { price: asset?.price ?? 0, change: asset?.change24h ?? 0, isLoading: false }
  }, [symbol])

  const query = useQuery({
    queryKey: ['quote', 'stock', symbol],
    enabled: !useMock && !!symbol,
    refetchInterval: 60_000,
    refetchOnMount: false,
    queryFn: async () => {
      const res = await fetch(`/api/quotes/stock/${symbol}`)
      if (!res.ok) throw new Error(`quotes/stock ${res.status}`)
      const json = (await res.json()) as { price: number; changePercent: number }
      console.info('[useStockPrice] %s backend price=%s', symbol, json.price)
      return { price: json.price, change: json.changePercent }
    },
  })

  if (useMock) return mockResult
  return {
    price: query.data?.price ?? 0,
    change: query.data?.change ?? 0,
    isLoading: query.isLoading,
  }
}
