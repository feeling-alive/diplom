import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNews } from '../hooks/useNews'
import NewsCard from '../components/news/NewsCard'
import { SearchInput } from '../components/ui/SearchInput'
import { EmptySearchState } from '../components/ui/EmptySearchState'

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
  const query = useDebounce(rawQuery, 400)

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
  const showEmpty = !isLoading && allArticles.length === 0

  console.debug('[NewsPage] render category=%s query=%s articles=%d', category, query, allArticles.length)

  return (
    <div style={{ padding: '16px 20px 24px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchInput
          value={rawQuery}
          onChange={(v) => {
            console.debug('[NewsPage] search query=%s', v)
            setRawQuery(v)
          }}
          placeholder="Поиск по заголовку или описанию..."
          fullWidth
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

      {/* Loading */}
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

      {/* Empty state */}
      {showEmpty && (
        <EmptySearchState
          message={rawQuery ? 'Ничего не найдено по запросу' : 'Нет новостей по заданным фильтрам'}
        />
      )}

      {/* Articles with Framer Motion stagger */}
      <AnimatePresence mode="wait">
        <motion.div
          key={query + category}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {allArticles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <NewsCard article={article} index={i} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

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
