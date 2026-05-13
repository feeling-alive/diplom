import { useState } from 'react'
import { motion } from 'framer-motion'
import type { NewsItem } from '../../types/market.types'
import { MOCK_NEWS } from '../../mock/news.mock'

type NewsFilter = 'all' | 'crypto' | 'stock' | 'forex'

const CRYPTO_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']
const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'SPX']
const FOREX_SYMBOLS = ['EUR-USD', 'GBP-USD']

const TABS: { key: NewsFilter; label: string }[] = [
  { key: 'all', label: 'Всё' },
  { key: 'crypto', label: 'Крипто' },
  { key: 'stock', label: 'Акции' },
  { key: 'forex', label: 'Форекс' },
]

function filterNews(news: NewsItem[], filter: NewsFilter): NewsItem[] {
  if (filter === 'all') return news
  const sets: Record<NewsFilter, string[]> = {
    all: [],
    crypto: CRYPTO_SYMBOLS,
    stock: STOCK_SYMBOLS,
    forex: FOREX_SYMBOLS,
  }
  const symbols = sets[filter]
  return news.filter((n) => n.relatedAssets.some((s) => symbols.includes(s)))
}

function sentimentColor(s: NewsItem['sentiment']): string {
  if (s === 'positive') return 'var(--green)'
  if (s === 'negative') return 'var(--accent)'
  return 'var(--muted)'
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} мин`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч`
  return `${Math.floor(hours / 24)} д`
}

interface Props {
  news?: NewsItem[]
}

export default function NewsWidget({ news = MOCK_NEWS }: Props) {
  const [filter, setFilter] = useState<NewsFilter>('all')

  const filtered = filterNews(news, filter).slice(0, 4)

  console.debug('[NewsWidget] filter=', filter, 'showing', filtered.length, 'items')

  return (
    <div
      style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Новости рынка
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              background: filter === tab.key ? 'var(--ink)' : 'transparent',
              color: filter === tab.key ? '#fff' : 'var(--muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* News items */}
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Нет новостей</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ x: -2, borderLeftColor: 'var(--accent)' }}
              onClick={() => console.info('[NewsWidget] navigate /news/', item.id)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '8px 0',
                cursor: 'pointer',
                borderLeft: '2px solid transparent',
                paddingLeft: 0,
                transition: 'border-left-color 0.15s, padding-left 0.15s',
              }}
            >
              {/* Sentiment dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sentimentColor(item.sentiment),
                  marginTop: 4,
                  flexShrink: 0,
                }}
              />

              {/* Text block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text)',
                    margin: 0,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  } as React.CSSProperties}
                >
                  {item.title}
                </p>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {item.source} · {formatRelativeTime(item.publishedAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
