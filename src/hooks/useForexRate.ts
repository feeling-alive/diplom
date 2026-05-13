import { useState, useEffect, useMemo } from 'react'
import { MOCK_PRICES } from '../mock/prices.mock'

interface ForexRateResult {
  rate: number
  isLoading: boolean
}

export function useForexRate(from: string, to: string, useMock = true): ForexRateResult {
  // Mock values derived synchronously — no effect needed for static data
  const mockResult = useMemo<ForexRateResult>(() => {
    const symbol = `${from}-${to}`
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'forex')
    console.debug('[useForexRate]', symbol, 'mock rate=', asset?.price ?? 0)
    return { rate: asset?.price ?? 0, isLoading: false }
  }, [from, to])

  const [rate, setRate] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (useMock) return

    // TODO: real impl — GET https://api.frankfurter.app/latest
    const fetchRate = async () => {
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
        const json = (await res.json()) as { rates: Record<string, number> }
        const value = json.rates[to]
        if (value !== undefined) {
          setRate(value)
          setIsLoading(false)
          console.debug('[useForexRate]', from, to, 'rate=', value)
        }
      } catch (err) {
        console.error('[useForexRate] fetch error:', err)
      }
    }

    void fetchRate()
  }, [from, to, useMock])

  if (useMock) return mockResult
  return { rate, isLoading }
}
