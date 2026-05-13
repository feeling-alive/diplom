import { useQuery } from '@tanstack/react-query'
import type { NewsItem } from '../types/market.types'
import { MOCK_NEWS } from '../mock/news.mock'

interface NewsResult {
  news: NewsItem[]
  isLoading: boolean
  error: Error | null
}

export function useNews(relatedAsset?: string, useMock = true): NewsResult {
  const { data, isLoading, error } = useQuery<NewsItem[], Error>({
    queryKey: ['news', relatedAsset, useMock],
    queryFn: async () => {
      if (useMock) {
        const filtered = relatedAsset
          ? MOCK_NEWS.filter((item) => item.relatedAssets.includes(relatedAsset))
          : MOCK_NEWS
        console.debug('[useNews] mock relatedAsset=', relatedAsset ?? 'all', 'count=', filtered.length)
        return filtered
      }

      // TODO: real impl — GET NewsAPI
      const query = relatedAsset ?? 'finance'
      const key = (import.meta.env.VITE_NEWSAPI_KEY as string | undefined) ?? ''
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${key}&pageSize=10`,
      )
      const json = (await res.json()) as {
        articles: Array<{
          title: string
          description: string
          source: { name: string }
          url: string
          publishedAt: string
        }>
      }
      console.debug('[useNews] NewsAPI count=', json.articles.length)
      return json.articles.map((a, i) => ({
        id: `api-${i}`,
        title: a.title,
        summary: a.description ?? '',
        source: a.source.name,
        url: a.url,
        publishedAt: a.publishedAt,
        sentiment: 'neutral' as const,
        relatedAssets: relatedAsset ? [relatedAsset] : [],
      }))
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
