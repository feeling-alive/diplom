import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../lib/env'

// Трендовые монеты из бэкенд-прокси /api/quotes/trending (CoinGecko
// /search/trending + Redis). Браузер больше не ходит в api.coingecko.com напрямую
// (CORS + rate-limit). Один общий Query-кэш (Задача B1).

export interface TrendingCoin {
  id: string
  symbol: string
  name: string
  marketCapRank: number | null
  thumb: string | null
  priceUsd: number
}

const MOCK: TrendingCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', marketCapRank: 1, thumb: null, priceUsd: 0 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', marketCapRank: 2, thumb: null, priceUsd: 0 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', marketCapRank: 5, thumb: null, priceUsd: 0 },
]

async function fetchTrending(): Promise<TrendingCoin[]> {
  const res = await fetch('/api/quotes/trending')
  if (!res.ok) throw new Error(`quotes/trending ${res.status}`)
  const json = (await res.json()) as { coins: TrendingCoin[]; source?: string }
  console.debug('[useTrending] coins=%d source=%s', json.coins?.length ?? 0, json.source)
  return json.coins ?? []
}

export function useTrending(useMock = USE_MOCK): { data: TrendingCoin[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<TrendingCoin[], Error>({
    queryKey: ['trending-coins'],
    queryFn: fetchTrending,
    enabled: !useMock,
    // Тренды меняются медленно; CoinGecko free-tier жёстко лимитирован.
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnMount: false,
    retry: 1,
  })

  if (useMock) return { data: MOCK, isLoading: false }
  return { data: data ?? [], isLoading: isLoading && !data }
}
