import { useQuery } from '@tanstack/react-query'
import type { NewsItem } from '../types/market.types'
import { MOCK_NEWS } from '../mock/news.mock'
import { ENV, USE_MOCK } from '../lib/env'

interface NewsResult {
  news: NewsItem[]
  isLoading: boolean
  error: Error | null
}

function mockSlice(relatedAsset?: string): NewsItem[] {
  return relatedAsset
    ? MOCK_NEWS.filter((item) => item.relatedAssets.includes(relatedAsset))
    : MOCK_NEWS
}

export function useNews(relatedAsset?: string, useMock = USE_MOCK): NewsResult {
  const { data, isLoading, error } = useQuery<NewsItem[], Error>({
    queryKey: ['news', relatedAsset, useMock],
    queryFn: async () => {
      if (useMock || !ENV.NEWS_API_KEY) {
        const list = mockSlice(relatedAsset)
        console.debug('[useNews] mock relatedAsset=%s count=%d', relatedAsset ?? 'all', list.length)
        return list
      }

      const query = relatedAsset ?? 'finance'
      try {
        const res = await fetch(
          `${ENV.NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(query)}&pageSize=20&sortBy=publishedAt&apiKey=${ENV.NEWS_API_KEY}`,
        )
        if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
        const json = (await res.json()) as {
          articles: Array<{
            title: string
            description: string | null
            source: { name: string }
            url: string
            publishedAt: string
          }>
        }
        console.info('[useNews] NewsAPI count=%d query=%s', json.articles.length, query)
        return json.articles
          .filter((a) => a.title && !a.title.includes('[Removed]'))
          .map((a, i) => ({
            id: `api-${i}`,
            title: a.title,
            summary: a.description ?? '',
            source: a.source.name,
            url: a.url,
            publishedAt: a.publishedAt,
            sentiment: 'neutral' as const,
            relatedAssets: relatedAsset ? [relatedAsset] : [],
          }))
      } catch (err) {
        console.warn('[useNews] real fetch failed — falling back to mock:', err)
        return mockSlice(relatedAsset)
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  return {
    news: data ?? [],
    isLoading,
    error: error ?? null,
  }
}
