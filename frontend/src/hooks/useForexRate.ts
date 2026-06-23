import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MOCK_PRICES } from '../mock/prices.mock'
import { USE_MOCK } from '../lib/env'

interface ForexRateResult {
  rate: number
  isLoading: boolean
}

// [Задача 2] Курс кэшируется в QueryClient по паре валют → повторный заход не
// перезагружает данные с нуля, пока кэш свеж.
export function useForexRate(from: string, to: string, useMock = USE_MOCK): ForexRateResult {
  const mockResult = useMemo<ForexRateResult>(() => {
    const symbol = `${from}-${to}`
    const asset = MOCK_PRICES.find((a) => a.symbol === symbol && a.type === 'forex')
    console.debug('[useForexRate] %s mock rate=%s', symbol, asset?.price ?? 0)
    return { rate: asset?.price ?? 0, isLoading: false }
  }, [from, to])

  // Frankfurter не включает базовую валюту в ответ, поэтому from===to вернул бы
  // 502 и rate=0. Курс валюты к самой себе — всегда 1 (Задача A4).
  const samePair = !!from && from === to

  const query = useQuery({
    queryKey: ['quote', 'forex', from, to],
    enabled: !useMock && !!from && !!to && !samePair,
    refetchInterval: 60_000,
    refetchOnMount: false,
    queryFn: async () => {
      const res = await fetch(`/api/quotes/forex/${from}/${to}`)
      if (!res.ok) throw new Error(`quotes/forex ${res.status}`)
      const json = (await res.json()) as { rate: number }
      console.info('[useForexRate] %s->%s rate=%s', from, to, json.rate)
      return json.rate
    },
  })

  if (useMock) return mockResult
  if (samePair) return { rate: 1, isLoading: false }
  return { rate: query.data ?? 0, isLoading: query.isLoading }
}
