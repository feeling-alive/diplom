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
        const res = await fetch(`/api/quotes/forex/${from}/${to}`)
        if (!res.ok) throw new Error(`quotes/forex ${res.status}`)
        const json = (await res.json()) as { rate: number }
        setRate(json.rate)
        setIsLoading(false)
        console.info('[useForexRate] %s->%s rate=%s', from, to, json.rate)
      } catch (err) {
        console.warn('[useForexRate] fetch error:', err)
      }
    }

    void fetchRate()
  }, [from, to, useMock])

  if (useMock) return mockResult
  return { rate, isLoading }
}
