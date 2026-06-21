import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

export interface NewsArticle {
  id: string
  title: string
  title_ru: string | null
  description: string | null
  description_ru: string | null
  url: string
  url_to_image: string | null
  source_name: string
  published_at: string
  category: string
  symbols: string[] | null
  keywords: string[] | null
  market_impact: string | null
  ai_processed: boolean
  likes_count: number
  dislikes_count: number
  comments_count: number
  is_favorited: boolean
  user_reaction: string | null
}

export interface NewsFeedPage {
  articles: NewsArticle[]
  total: number
  page: number
  has_more: boolean
}

async function fetchNewsPage(
  page: number,
  query: string,
  category: string,
  symbol: string,
  limit = 20,
): Promise<NewsFeedPage> {
  console.debug('[useNews] fetch page', page, 'category', category, 'query', query, 'symbol', symbol)
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (query) params.set('query', query)
  if (category && category !== 'all') params.set('category', category)
  if (symbol) params.set('symbol', symbol)
  const res = await fetch(`/api/news?${params}`)
  if (!res.ok) throw new Error(`GET /api/news ${res.status}`)
  return res.json() as Promise<NewsFeedPage>
}

/**
 * Infinite-scroll news feed, backed by our backend.
 * @param symbol — optional base-ticker filter (BTC, AAPL) matched against symbols[].
 */
export function useNews(query = '', category = 'all', symbol = '') {
  return useInfiniteQuery<NewsFeedPage, Error>({
    queryKey: ['news', query, category, symbol],
    queryFn: ({ pageParam }) => fetchNewsPage(pageParam as number, query, category, symbol),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  })
}

/** Single article by id. */
export function useNewsArticle(id: string) {
  return useQuery<NewsArticle, Error>({
    queryKey: ['news', 'article', id],
    queryFn: async () => {
      console.debug('[useNewsArticle] load', id)
      const res = await fetch(`/api/news/${id}`)
      if (!res.ok) throw new Error(`GET /api/news/${id} ${res.status}`)
      return res.json() as Promise<NewsArticle>
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}

/** Favorite news for the current user. */
export function useNewsFavorites() {
  return useQuery<NewsFeedPage, Error>({
    queryKey: ['news', 'favorites'],
    queryFn: async () => {
      const res = await fetch('/api/news/favorites')
      if (!res.ok) throw new Error(`GET /api/news/favorites ${res.status}`)
      return res.json() as Promise<NewsFeedPage>
    },
    staleTime: 2 * 60 * 1000,
  })
}

/** React to an article (like/dislike toggle). */
export async function reactToArticle(id: string, type: 'like' | 'dislike'): Promise<void> {
  await fetch(`/api/news/${id}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  })
}

/** Toggle favorite on an article. */
export async function toggleFavorite(id: string): Promise<void> {
  await fetch(`/api/news/${id}/favorite`, { method: 'POST' })
}
