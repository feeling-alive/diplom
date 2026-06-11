import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MOCK_PRICES } from '../mock/prices.mock'
import { MOCK_NEWS } from '../mock/news.mock'
import { USE_MOCK } from '../lib/env'

export interface AssetResult {
  symbol: string
  name: string
  type: string
  price?: number
}

export interface NewsResult {
  id: string
  title: string
  titleRu?: string
  publishedAt: string
  category?: string
}

export interface GlobalSearchResult {
  assets: AssetResult[]
  news: NewsResult[]
}

interface UseGlobalSearchReturn {
  data: GlobalSearchResult | null
  isLoading: boolean
  error: Error | null
}

const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 2
const ASSET_LIMIT = 5
const NEWS_LIMIT = 5

function mockSearch(query: string): GlobalSearchResult {
  const q = query.toLowerCase()
  const assets = MOCK_PRICES
    .filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    .slice(0, ASSET_LIMIT)
    .map((a) => ({ symbol: a.symbol, name: a.name, type: a.type, price: a.price }))

  const news = MOCK_NEWS
    .filter((n) => n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
    .slice(0, NEWS_LIMIT)
    .map((n) => ({ id: n.id, title: n.title, publishedAt: n.publishedAt }))

  return { assets, news }
}

async function fetchSearch(query: string): Promise<GlobalSearchResult> {
  const url = `/api/search?q=${encodeURIComponent(query)}`
  console.debug('[useGlobalSearch] fetch %s', url)
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`/api/search ${res.status}`)
  const json = await res.json() as {
    assets: Array<{ symbol: string; name: string; type: string; price?: number }>
    news: Array<{ id: string; title: string; title_ru?: string; published_at: string; category?: string }>
  }
  return {
    assets: json.assets,
    news: json.news.map((n) => ({
      id: n.id,
      title: n.title,
      titleRu: n.title_ru ?? undefined,
      publishedAt: n.published_at,
      category: n.category ?? undefined,
    })),
  }
}

export function useGlobalSearch(query: string, useMock = USE_MOCK): UseGlobalSearchReturn {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  console.debug('[useGlobalSearch] query=%s debounced=%s', query, debouncedQuery)

  const enabled = debouncedQuery.trim().length >= MIN_QUERY_LENGTH

  const { data, isLoading, error } = useQuery<GlobalSearchResult, Error>({
    queryKey: ['globalSearch', debouncedQuery, useMock],
    queryFn: async () => {
      if (useMock) {
        console.debug('[useGlobalSearch] mock mode q=%s', debouncedQuery)
        return mockSearch(debouncedQuery)
      }
      try {
        const result = await fetchSearch(debouncedQuery)
        console.debug('[useGlobalSearch] results: assets=%d news=%d', result.assets.length, result.news.length)
        return result
      } catch (err) {
        console.warn('[useGlobalSearch] API failed, falling back to mock', err)
        return mockSearch(debouncedQuery)
      }
    },
    enabled,
    staleTime: 30_000,
  })

  if (!enabled) {
    return { data: null, isLoading: false, error: null }
  }

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
  }
}
