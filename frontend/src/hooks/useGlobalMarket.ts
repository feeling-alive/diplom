import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../lib/env'

// Глобальные метрики крипторынка из бэкенд-прокси /api/quotes/global
// (CoinGecko /global с Redis-кэшем). Один общий ключ Query → market_volume и
// global_market_cap делят один запрос/кэш и больше не дёргают CoinGecko из
// браузера напрямую (CORS + rate-limit).

export interface GlobalMarket {
  totalMarketCapUsd: number
  totalVolumeUsd: number
  btcDominance: number
  ethDominance: number
  marketCapChange24h: number
  isStale: boolean
}

const MOCK: GlobalMarket = {
  totalMarketCapUsd: 2.4e12,
  totalVolumeUsd: 90e9,
  btcDominance: 54,
  ethDominance: 17,
  marketCapChange24h: 0,
  isStale: true,
}

async function fetchGlobal(): Promise<GlobalMarket> {
  const res = await fetch('/api/quotes/global')
  if (!res.ok) throw new Error(`quotes/global ${res.status}`)
  const json = (await res.json()) as GlobalMarket & { source?: string }
  console.debug('[useGlobalMarket] cap=%s vol=%s btc=%s%% source=%s', json.totalMarketCapUsd, json.totalVolumeUsd, json.btcDominance, json.source)
  return json
}

export function useGlobalMarket(useMock = USE_MOCK): { data: GlobalMarket | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<GlobalMarket, Error>({
    queryKey: ['global-market'],
    queryFn: fetchGlobal,
    enabled: !useMock,
    // /global меняется медленно; CoinGecko free-tier жёстко лимитирован.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnMount: false,
    retry: 1,
  })

  if (useMock) return { data: MOCK, isLoading: false }
  return { data: data ?? null, isLoading: isLoading && !data }
}
