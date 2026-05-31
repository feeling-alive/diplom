import { motion } from 'framer-motion'
import { useNews } from '../../hooks/useNews'
import type { NewsItem } from '../../types/market.types'

interface Props {
  symbol: string
  ticker?: string
}

function sentimentColor(s: NewsItem['sentiment']): string {
  if (s === 'positive') return 'var(--green)'
  if (s === 'negative') return 'var(--accent)'
  return 'var(--muted)'
}

function timeAgo(iso: string): string {
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} д назад`
}

function NewsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 10, opacity: 0.5 - i * 0.05 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, width: '90%', borderRadius: 4, background: 'var(--border)', marginBottom: 6 }} />
            <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--border)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NewsPanel({ symbol, ticker }: Props) {
  const { news, isLoading } = useNews(symbol)
  const label = ticker ?? symbol

  console.debug('[NewsPanel] symbol=%s count=%d loading=%s', symbol, news.length, isLoading)

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Новости</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {label}</span>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent',
      }}>
        {isLoading ? (
          <NewsSkeleton />
        ) : news.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            Нет новостей по {label}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {news.map((item, i) => (
              <motion.a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                whileHover={{ y: -1 }}
                onClick={() => console.debug('[NewsPanel] open news id=%s url=%s', item.id, item.url)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s, border-color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sentimentColor(item.sentiment),
                  marginTop: 6,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                    {item.source} · {timeAgo(item.publishedAt)}
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
