import { motion } from 'framer-motion'
import { useNews, type NewsArticle } from '../../hooks/useNews'
import MarketImpactBadge from '../news/MarketImpactBadge'

interface Props {
  symbol: string
  ticker?: string
}

// Base ticker for the symbols[] filter: BTC-USDT -> BTC, AAPL -> AAPL.
function baseTicker(symbol: string): string {
  return symbol.split('-')[0].toUpperCase()
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} д назад`
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
  // Bridge market impact to the asset: filter the feed by the asset's base ticker
  // against the enriched symbols[] array (bug #5) instead of a fuzzy text search.
  const { data, isLoading } = useNews('', 'all', baseTicker(symbol))
  const news: NewsArticle[] = data?.pages[0]?.articles ?? []
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

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
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
                onClick={() => console.debug('[NewsPanel] open article', item.id)}
                style={{
                  display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
                  background: 'transparent', border: '1px solid transparent',
                  textDecoration: 'none', color: 'inherit', transition: 'background 0.15s, border-color 0.15s', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                    {item.title_ru || item.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    {item.market_impact && <MarketImpactBadge impact={item.market_impact} compact />}
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {item.source_name} · {timeAgo(item.published_at)}
                    </span>
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
