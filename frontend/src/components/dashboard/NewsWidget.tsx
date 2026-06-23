import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import type { WidgetSizeProps } from '../../types/widgets.types'
import { useNews, useNewsFavorites } from '../../hooks/useNews'
import { useAuth } from '../../context/AuthContext'

function impactColor(impact: string | null): string {
  if (impact === 'positive') return 'var(--green)'
  if (impact === 'negative') return 'var(--red)'
  return 'var(--muted)'
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} мин`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч`
  return `${Math.floor(hours / 24)} д`
}

export default function NewsWidget({ gridW = 2, gridH = 2 }: WidgetSizeProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const limit = gridH >= 3 ? (gridW >= 3 ? 8 : 6) : (gridW >= 3 ? 4 : 3)

  // [4.4] Вкладка контролируется ЯВНО пользователем (кнопка-переключатель), а не
  // авто-подменяется при появлении избранного. По умолчанию — «Все новости».
  const [showFavorites, setShowFavorites] = useState(false)

  const { data: favData } = useNewsFavorites()
  const favArticles = user ? (favData?.articles ?? []) : []

  const { data: latestData } = useNews('', 'all')
  const latestArticles = latestData?.pages[0]?.articles ?? []

  const articles = (showFavorites ? favArticles : latestArticles).slice(0, limit)

  console.debug('[NewsWidget] view=%s count=%d favs=%d', showFavorites ? 'favorites' : 'latest', articles.length, favArticles.length)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Новости рынка</span>
        {user && (
          <button
            onClick={() => setShowFavorites((v) => !v)}
            title={showFavorites ? 'Показать все новости' : 'Показать избранное'}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
              border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px',
              background: showFavorites ? 'var(--accent)' : 'var(--bg)',
              color: showFavorites ? '#fff' : 'var(--muted)',
            }}
          >
            <Star size={10} fill={showFavorites ? '#fff' : 'none'} />
            {showFavorites ? 'Избранное' : 'Все'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {articles.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            {showFavorites ? 'В избранном пока пусто — добавьте новости ★' : 'Загрузка...'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {articles.map((article) => {
              const title = article.title_ru || article.title
              return (
                <motion.div
                  key={article.id}
                  whileHover={{ x: -2, borderLeftColor: 'var(--accent)' }}
                  onClick={() => navigate(`/news/${article.id}`)}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '8px 0', paddingLeft: 0, cursor: 'pointer',
                    borderLeft: '2px solid transparent', transition: 'border-left-color 0.15s',
                  }}
                >
                  {article.url_to_image ? (
                    <img
                      src={article.url_to_image}
                      alt=""
                      style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: impactColor(article.market_impact),
                      marginTop: 4, flexShrink: 0,
                    }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0,
                      lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}>
                      {title}
                    </p>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {article.source_name} · {formatRelative(article.published_at)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
