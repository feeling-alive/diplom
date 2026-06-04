import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useNewsArticle, reactToArticle, toggleFavorite } from '../hooks/useNews'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

interface Comment {
  id: string
  username: string
  avatar_url: string | null
  text: string
  created_at: string
}

function useComments(articleId: string) {
  return useQuery<Comment[]>({
    queryKey: ['news', 'comments', articleId],
    queryFn: async () => {
      const res = await fetch(`/api/news/${articleId}/comments`)
      if (!res.ok) throw new Error(`comments ${res.status}`)
      return res.json()
    },
    enabled: !!articleId,
  })
}

function MarketImpactBadge({ impact }: { impact: string | null }) {
  if (!impact) return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: '📈 Позитивно', color: '#16a34a', bg: '#dcfce7' },
    negative: { label: '📉 Негативно', color: '#dc2626', bg: '#fee2e2' },
    neutral:  { label: '➡️ Нейтрально', color: '#6b7280', bg: '#f3f4f6' },
  }
  const s = map[impact] ?? map.neutral
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      color: s.color, background: s.bg,
    }}>{s.label}</span>
  )
}

export default function NewsArticlePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [commentText, setCommentText] = useState('')

  console.debug('[NewsArticlePage] load article', id)

  const { data: article, isLoading, error } = useNewsArticle(id)
  const { data: comments = [] } = useComments(id)

  const submitComment = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/news/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`comment ${res.status}`)
    },
    onSuccess: () => {
      setCommentText('')
      qc.invalidateQueries({ queryKey: ['news', 'comments', id] })
      qc.invalidateQueries({ queryKey: ['news', 'article', id] })
    },
  })

  async function handleReact(type: 'like' | 'dislike') {
    await reactToArticle(id, type)
    qc.invalidateQueries({ queryKey: ['news', 'article', id] })
  }

  async function handleFav() {
    await toggleFavorite(id)
    qc.invalidateQueries({ queryKey: ['news', 'article', id] })
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Загрузка...</div>
    )
  }
  if (error || !article) {
    return (
      <div style={{ padding: 24, color: 'var(--red)', fontSize: 13 }}>Статья не найдена</div>
    )
  }

  const title = article.title_ru || article.title
  const description = article.description_ru || article.description

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ padding: 20, maxWidth: 760, margin: '0 auto' }}
    >
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
          color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 16, fontFamily: 'var(--font)', padding: 0,
        }}
      >
        <ArrowLeft size={16} /> Назад
      </button>

      {/* Image */}
      {article.url_to_image && (
        <img
          src={article.url_to_image}
          alt=""
          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 'var(--r-lg)', marginBottom: 20 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {article.ai_processed !== false && <MarketImpactBadge impact={article.market_impact} />}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {article.source_name} · {new Date(article.published_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 16 }}>
        {title}
      </h1>

      {/* Keyword chips */}
      {article.keywords && article.keywords.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {article.keywords.map((kw) => (
            <span key={kw} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 999,
              background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--accent)',
              fontWeight: 600,
            }}>{kw}</span>
          ))}
        </div>
      )}

      {/* Body */}
      {description && (
        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20 }}>
          {description}
        </p>
      )}

      {/* Read original */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px',
          borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)',
          fontSize: 13, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none',
          marginBottom: 24,
        }}
      >
        <ExternalLink size={14} /> Читать оригинал
      </a>

      {/* Reactions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <ReactionBtn icon={<ThumbsUp size={16} />} count={article.likes_count}
          active={article.user_reaction === 'like'} color="var(--green)"
          onClick={() => handleReact('like')} />
        <ReactionBtn icon={<ThumbsDown size={16} />} count={article.dislikes_count}
          active={article.user_reaction === 'dislike'} color="var(--red)"
          onClick={() => handleReact('dislike')} />
        <ReactionBtn icon={<Star size={16} />} count={0}
          active={article.is_favorited} color="var(--yellow, #f59e0b)"
          onClick={handleFav} label={article.is_favorited ? 'В избранном' : 'В избранное'} />
      </div>

      {/* Comments */}
      <div id="comments">
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
          Комментарии ({article.comments_count})
        </h2>

        {user ? (
          <div style={{ marginBottom: 20 }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Напишите комментарий..."
              rows={3}
              style={{
                width: '100%', padding: 12, borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'var(--bg)',
                fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              disabled={commentText.trim().length < 3 || submitComment.isPending}
              onClick={() => submitComment.mutate(commentText.trim())}
              style={{
                marginTop: 8, padding: '8px 20px', borderRadius: 999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: commentText.trim().length < 3 ? 'not-allowed' : 'pointer',
                opacity: commentText.trim().length < 3 ? 0.5 : 1,
                fontFamily: 'var(--font)',
              }}
            >
              Отправить
            </button>
          </div>
        ) : (
          <div style={{
            padding: 16, borderRadius: 'var(--r-md)', background: 'var(--bg)',
            fontSize: 13, color: 'var(--muted)', marginBottom: 16,
          }}>
            Войдите, чтобы оставить комментарий
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map((c) => (
            <div key={c.id} style={{
              padding: 14, borderRadius: 'var(--r-md)', background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {c.username.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{c.username}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {new Date(c.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
    </div>
  )
}

function ReactionBtn({
  icon, count, active, color, onClick, label,
}: {
  icon: React.ReactNode
  count: number
  active: boolean
  color: string
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        borderRadius: 999, border: '1px solid ' + (active ? color : 'var(--border)'),
        background: active ? color + '18' : 'var(--white)', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: active ? color : 'var(--muted)',
        fontFamily: 'var(--font)',
      }}
    >
      {icon}
      {label && <span>{label}</span>}
      {!label && count > 0 && <span>{count}</span>}
    </button>
  )
}
