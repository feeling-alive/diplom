import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../lib/env'

// Shared Fear & Greed source for FearGreedWidget + SentimentMeterWidget. Single
// TanStack Query key (`['fng']`) means both widgets share one backend fetch and
// one cache entry (backend Redis TTL = 1h).

export interface FngData {
  value: number
  label: string
  timestamp: number
}

interface FngBackendPayload {
  value: number
  label: string
  timestamp: number
  timeUntilUpdate?: number
  fetchedAt: number
  source: 'alternative.me' | 'cache' | 'fallback'
}

export function fngLabel(value: number): string {
  if (value >= 75) return 'Жадность'
  if (value >= 50) return 'Нейтрально'
  if (value >= 25) return 'Страх'
  return 'Крайний страх'
}

export function fngColor(value: number): string {
  if (value >= 75) return '#22c55e'
  if (value >= 50) return '#f97316'
  if (value >= 25) return '#f59e0b'
  return '#ef4444'
}

const MOCK_DATA: FngData = { value: 72, label: fngLabel(72), timestamp: Math.floor(Date.now() / 1000) }

async function fetchFng(): Promise<FngData> {
  const res = await fetch('/api/quotes/fng')
  if (!res.ok) throw new Error(`quotes/fng ${res.status}`)
  const json = (await res.json()) as FngBackendPayload
  console.info('[useFearGreed] backend value=%d label=%s source=%s', json.value, json.label, json.source)
  return { value: json.value, label: fngLabel(json.value), timestamp: json.timestamp }
}

export function useFearGreed(useMock = USE_MOCK): { data: FngData | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<FngData, Error>({
    queryKey: ['fng'],
    queryFn: fetchFng,
    enabled: !useMock,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })

  if (useMock) return { data: MOCK_DATA, isLoading: false }
  return { data: data ?? null, isLoading: isLoading && !data }
}
