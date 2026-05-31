import { useState } from 'react'
import { motion } from 'framer-motion'
import type { NewsItem } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'
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

interface Props extends WidgetSizeProps {
  news?: NewsItem[]
}

export default function NewsWidget({ news = MOCK_NEWS, gridW = 2, gridH = 2 }: Props) {
  const [filter, setFilter] = useState<NewsFilter>('all')
  // Lim per size: 2x2→3, 2x3→6, 3x2→4, 3x3→8 — расти и по высоте, и по ширине
  const limit = gridH >= 3 ? (gridW >= 3 ? 8 : 6) : (gridW >= 3 ? 4 : 3)
  const filtered = filterNews(news, filter).slice(0, limit)

  console.debug('[NewsWidget] gridW=%d gridH=%d filter=%s showing=%d', gridW, gridH, filter, filtered.length)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{ marginBottom: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          Новости рынка
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexShrink: 0, flexWrap: 'wrap' }}>
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

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text)',
                    margin: 0,
                    lineHeight: 1.4,
                    // [FIX] заголовки переносятся целиком, без ellipsis — спека vidget fix.md
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.title}
                </p>
                <span style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.source} · {formatRelativeTime(item.publishedAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
