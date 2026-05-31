import { useState, useEffect, useMemo } from 'react'
import { MOCK_PRICES } from '../mock/prices.mock'
import { ENV, USE_MOCK } from '../lib/env'

interface ForexRateResult {
  rate: number
  isLoading: boolean
}

export function useForexRate(from: string, to: string, useMock = USE_MOCK): ForexRateResult {
  const mockResult = useMemo<ForexRateResult>(() => {
    const symbol = `${from}-${to}`
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'forex')
    console.debug('[useForexRate] %s mock rate=%s', symbol, asset?.price ?? 0)
    return { rate: asset?.price ?? 0, isLoading: false }
  }, [from, to])

  const [rate, setRate] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (useMock) return

    const fetchRate = async () => {
      try {
        const res = await fetch(`${ENV.FRANKFURTER_BASE_URL}/latest?from=${from}&to=${to}`)
        const json = (await res.json()) as { rates: Record<string, number> }
        const value = json.rates[to]
        if (value !== undefined) {
          setRate(value)
          setIsLoading(false)
          console.info('[useForexRate] %s->%s rate=%s', from, to, value)
        }
      } catch (err) {
        console.warn('[useForexRate] fetch error:', err)
      }
    }

    void fetchRate()
  }, [from, to, useMock])

  if (useMock) return mockResult
  return { rate, isLoading }
}
