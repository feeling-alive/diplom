import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { NewsArticle } from '../../hooks/useNews'
import { reactToArticle, toggleFavorite } from '../../hooks/useNews'

interface Props {
  article: NewsArticle
  index?: number
}

function MarketImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: '📈 Позитивно', color: '#16a34a', bg: '#dcfce7' },
    negative: { label: '📉 Негативно', color: '#dc2626', bg: '#fee2e2' },
    neutral:  { label: '➡️ Нейтрально', color: '#6b7280', bg: '#f3f4f6' },
  }
  const style = map[impact] ?? map.neutral
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      color: style.color, background: style.bg, flexShrink: 0,
    }}>
      {style.label}
    </span>
  )
}

function ImageOrPlaceholder({ url, source }: { url: string | null; source: string }) {
  const letter = source.charAt(0).toUpperCase()
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div style={{
      width: 72, height: 72, borderRadius: 'var(--r-md)', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-soft, #7c3aed) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, fontWeight: 800, color: '#fff',
    }}>
      {letter}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function NewsCard({ article: a, index = 0 }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const title = a.title_ru || a.title

  async function handleReact(type: 'like' | 'dislike', e: React.MouseEvent) {
    e.stopPropagation()
    await reactToArticle(a.id, type)
    qc.invalidateQueries({ queryKey: ['news'] })
  }

  async function handleFav(e: React.MouseEvent) {
    e.stopPropagation()
    await toggleFavorite(a.id)
    qc.invalidateQueries({ queryKey: ['news'] })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={() => navigate(`/news/${a.id}`)}
      style={{
        display: 'flex', gap: 12, padding: 14, borderRadius: 'var(--r-md)',
        background: 'var(--white)', border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'box-shadow 0.15s',
      }}
      whileHover={{ boxShadow: 'var(--shadow-md)' }}
    >
      <ImageOrPlaceholder url={a.url_to_image} source={a.source_name} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Top row: impact badge + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <MarketImpactBadge impact={a.market_impact} />
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
            {formatDate(a.published_at)}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </h3>

        {/* Source */}
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {a.source_name}
        </div>

        {/* Symbol chips */}
        {a.symbols && a.symbols.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {a.symbols.slice(0, 5).map((s) => (
              <span key={s} style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)',
              }}>{s}</span>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <ActionBtn icon={<ThumbsUp size={12} />} count={a.likes_count}
            active={a.user_reaction === 'like'} color="var(--green)"
            onClick={(e) => handleReact('like', e)} />
          <ActionBtn icon={<ThumbsDown size={12} />} count={a.dislikes_count}
            active={a.user_reaction === 'dislike'} color="var(--red)"
            onClick={(e) => handleReact('dislike', e)} />
          <ActionBtn icon={<MessageCircle size={12} />} count={a.comments_count}
            onClick={(e) => { e.stopPropagation(); navigate(`/news/${a.id}#comments`) }} />
          <ActionBtn icon={<Star size={12} />} count={0}
            active={a.is_favorited} color="var(--yellow, #f59e0b)"
            onClick={handleFav} />
        </div>
      </div>
    </motion.div>
  )
}

function ActionBtn({
  icon, count, active = false, color = 'var(--muted)', onClick,
}: {
  icon: React.ReactNode
  count: number
  active?: boolean
  color?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        fontSize: 11, fontWeight: 600, background: 'none', border: 'none',
        color: active ? color : 'var(--muted)', cursor: 'pointer', padding: 0,
      }}
    >
      {icon}
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
