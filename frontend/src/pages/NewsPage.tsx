import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useNews } from '../hooks/useNews'
import NewsCard from '../components/news/NewsCard'

type Category = 'all' | 'crypto' | 'stocks' | 'forex' | 'general'

const TABS: { key: Category; label: string }[] = [
  { key: 'all',     label: 'Все' },
  { key: 'crypto',  label: 'Крипто' },
  { key: 'stocks',  label: 'Акции' },
  { key: 'forex',   label: 'Форекс' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function NewsPage() {
  const [rawQuery, setRawQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const query = useDebounce(rawQuery, 500)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useNews(query, category)

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const allArticles = data?.pages.flatMap((p) => p.articles) ?? []

  console.debug('[NewsPage] render category=%s query=%s articles=%d', category, query, allArticles.length)

  return (
    <div style={{ padding: '16px 20px 24px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)',
            borderRadius: 'var(--r-pill)', padding: '8px 14px', marginBottom: 12,
          }}>
            <Search size={14} color="var(--muted)" />
            <input
              placeholder="Поиск по заголовку или описанию..."
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              style={{
                background: 'none', border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--text)', width: '100%', fontFamily: 'var(--font)',
              }}
            />
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setCategory(t.key)}
                style={{
                  padding: '5px 14px', borderRadius: 'var(--r-pill)', fontSize: 12,
                  fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'var(--font)',
                  background: category === t.key ? 'var(--ink)' : 'var(--bg)',
                  color: category === t.key ? '#fff' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Articles */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
              <div style={{
                display: 'inline-block', width: 32, height: 32,
                border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ marginTop: 12, fontSize: 13 }}>Загрузка новостей...</p>
            </div>
          )}

          {!isLoading && allArticles.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>
              Нет новостей по заданным фильтрам
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allArticles.map((article, i) => (
              <NewsCard key={article.id} article={article} index={i} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {isFetchingNextPage && (
            <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: 12 }}>
              Загрузка...
            </div>
          )}
    </div>
  )
}
