import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNews } from '../hooks/useNews'
import { Search, Clock, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

type FilterType = 'all' | 'crypto' | 'stock' | 'forex'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'crypto', label: 'Крипто' },
  { key: 'stock', label: 'Акции' },
  { key: 'forex', label: 'Форекс' },
]

const ASSET_MAP: Record<string, FilterType> = {
  'BTC-USDT': 'crypto',
  'ETH-USDT': 'crypto',
  'SOL-USDT': 'crypto',
  AAPL: 'stock',
  MSFT: 'stock',
  'EUR-USD': 'forex',
  'GBP-USD': 'forex',
  SPX: 'stock',
}

function getFilterForNews(item: any, filter: FilterType): boolean {
  if (filter === 'all') return true
  return (item.relatedAssets || []).some(
    (a: string) => ASSET_MAP[a] === filter,
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface NewsCardProps {
  item: any
  index: number
  navigate: (path: string) => void
}

function NewsCard({ item, index, navigate }: NewsCardProps) {
  const isPositive = item.sentiment === 'positive'
  const isNegative = item.sentiment === 'negative'
  const dotColor = isPositive
    ? 'var(--green)'
    : isNegative
      ? 'var(--red)'
      : 'var(--soft)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => navigate(`/news/${item.id}`)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--r-md)',
        background: 'var(--bg)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        border: '1px solid transparent',
      }}
      whileHover={{ scale: 1.002 }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotColor,
          marginTop: 6,
          flexShrink: 0,
          boxShadow: `0 0 6px ${dotColor}40`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.5,
            marginBottom: 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.summary}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--soft)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            {formatDate(item.publishedAt)}
          </span>
          <span
            style={{
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: 10,
              letterSpacing: 0.5,
            }}
          >
            {item.source}
          </span>
        </div>
      </div>
      <ChevronRight size={16} color="var(--soft)" style={{ flexShrink: 0, marginTop: 4 }} />
    </motion.div>
  )
}

export default function NewsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { news, isLoading, error } = useNews()
  const navigate = useNavigate()

  const filteredNews = useMemo(() => {
    let result = news.filter((item) => getFilterForNews(item, activeFilter))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q),
      )
    }
    return result
  }, [news, activeFilter, searchQuery])

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--white)',
          borderRadius: 22,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 22px 22px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
              📰 Новости рынка
            </h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              Актуальные новости финансовых рынков
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg)',
                borderRadius: 'var(--r-pill)',
                padding: '8px 14px',
              }}
            >
              <Search size={14} strokeWidth={2} color="var(--muted)" />
              <input
                placeholder="Поиск по заголовку или тексту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--text)',
                  width: '100%',
                  fontFamily: 'var(--font)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: activeFilter === f.key ? 'var(--ink)' : 'var(--bg)',
                  color: activeFilter === f.key ? '#fff' : 'var(--muted)',
                  border: 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: 'center',
                padding: 40,
                color: 'var(--muted)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: 32,
                  height: 32,
                  border: '3px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ marginTop: 12, fontSize: 13 }}>Загрузка новостей...</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: 'center',
                padding: 40,
                color: 'var(--red)',
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                Ошибка загрузки новостей
              </p>
            </motion.div>
          )}

          {!isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {filteredNews.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 40,
                    color: 'var(--muted)',
                    fontSize: 14,
                  }}
                >
                  Нет новостей по заданным фильтрам
                </div>
              ) : (
                filteredNews.map((item, index) => (
                  <NewsCard key={item.id} item={item} index={index} navigate={navigate} />
                ))
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}