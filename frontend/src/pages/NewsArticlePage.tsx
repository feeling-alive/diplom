import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, Star, ThumbsDown, ThumbsUp, Reply } from 'lucide-react'
import { useNewsArticle, reactToArticle, toggleFavorite } from '../hooks/useNews'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

interface Comment {
  id: string
  username: string
  avatar_url: string | null
  text: string
  created_at: string
  parent_id: string | null
  likes_count: number
  dislikes_count: number
  user_reaction: 'like' | 'dislike' | null
  replies: Comment[]
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
    positive: { label: '📈 Позитивно', color: 'var(--pos)', bg: 'var(--pos-bg)' },
    negative: { label: '📉 Негативно', color: 'var(--neg)', bg: 'var(--neg-bg)' },
    neutral:  { label: '➡️ Нейтрально', color: 'var(--muted)', bg: 'var(--bg)' },
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  console.debug('[NewsArticlePage] load article', id)

  const { data: article, isLoading, error } = useNewsArticle(id)
  const { data: comments = [] } = useComments(id)

  const submitComment = useMutation({
    mutationFn: async ({ text, parent_id }: { text: string; parent_id?: string | null }) => {
      const res = await fetch(`/api/news/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parent_id: parent_id ?? null }),
      })
      if (!res.ok) throw new Error(`comment ${res.status}`)
    },
    onSuccess: () => {
      setCommentText('')
      setReplyText('')
      setReplyingTo(null)
      qc.invalidateQueries({ queryKey: ['news', 'comments', id] })
      qc.invalidateQueries({ queryKey: ['news', 'article', id] })
    },
  })

  async function handleReactComment(commentId: string, type: 'like' | 'dislike') {
    console.debug('[NewsArticlePage] react comment=%s type=%s', commentId, type)
    await fetch(`/api/news/comments/${commentId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    qc.invalidateQueries({ queryKey: ['news', 'comments', id] })
  }

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
              onChange={(e) => {
                setCommentText(e.target.value)
                // Auto-grow: fit height to content (bug #8), no manual corner drag.
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px'
              }}
              placeholder="Напишите комментарий..."
              rows={3}
              style={{
                width: '100%', padding: 12, borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'var(--bg)',
                fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)',
                resize: 'none', outline: 'none', boxSizing: 'border-box',
                minHeight: 72, maxHeight: 240, overflowY: 'auto',
              }}
            />
            <button
              disabled={commentText.trim().length < 3 || submitComment.isPending}
              onClick={() => submitComment.mutate({ text: commentText.trim() })}
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
          {comments.map((c, idx) => (
            <CommentCard
              key={c.id}
              comment={c}
              index={idx}
              articleId={id}
              replyingTo={replyingTo}
              replyText={replyText}
              onSetReplyingTo={setReplyingTo}
              onSetReplyText={setReplyText}
              onSubmitReply={(text, parentId) => submitComment.mutate({ text, parent_id: parentId })}
              onReact={handleReactComment}
              isSubmitting={submitComment.isPending}
              depth={0}
            />
          ))}
        </div>
      </div>
    </motion.div>
    </div>
  )
}

interface CommentCardProps {
  comment: Comment
  index: number
  articleId: string
  replyingTo: string | null
  replyText: string
  onSetReplyingTo: (id: string | null) => void
  onSetReplyText: (text: string) => void
  onSubmitReply: (text: string, parentId: string) => void
  onReact: (id: string, type: 'like' | 'dislike') => void
  isSubmitting: boolean
  depth: number
}

function CommentCard({
  comment: c, index, replyingTo, replyText, onSetReplyingTo,
  onSetReplyText, onSubmitReply, onReact, isSubmitting, depth,
}: CommentCardProps) {
  const isReplying = replyingTo === c.id
  const { user } = useAuth()

  console.debug('[NewsArticlePage] render comment=%s replies=%d depth=%d', c.id, c.replies.length, depth)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32) }}
    >
      <div style={{
        padding: 14, borderRadius: 'var(--r-md)', background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
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

        {/* Text */}
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, margin: '0 0 8px' }}>{c.text}</p>

        {/* Action buttons */}
        {user && (
          <div style={{ display: 'flex', gap: 8 }}>
            {depth === 0 && (
              <button
                onClick={() => {
                  onSetReplyingTo(isReplying ? null : c.id)
                  onSetReplyText('')
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: isReplying ? 'var(--accent)' : 'var(--muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font)', padding: 0,
                }}
              >
                <Reply size={13} strokeWidth={2} />
                Ответить
              </button>
            )}
            <button
              onClick={() => onReact(c.id, 'like')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: c.user_reaction === 'like' ? 'var(--green)' : 'var(--muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', padding: 0,
              }}
            >
              <ThumbsUp size={13} strokeWidth={2} />
              {c.likes_count > 0 && <span>{c.likes_count}</span>}
            </button>
            <button
              onClick={() => onReact(c.id, 'dislike')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: c.user_reaction === 'dislike' ? 'var(--red)' : 'var(--muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', padding: 0,
              }}
            >
              <ThumbsDown size={13} strokeWidth={2} />
              {c.dislikes_count > 0 && <span>{c.dislikes_count}</span>}
            </button>
          </div>
        )}
      </div>

      {/* Inline reply form */}
      <AnimatePresence>
        {isReplying && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginTop: 8, marginLeft: 20 }}
          >
            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
              <textarea
                value={replyText}
                onChange={(e) => {
                  onSetReplyText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                }}
                placeholder={`Ответ для ${c.username}...`}
                rows={2}
                style={{
                  width: '100%', padding: 10, borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)',
                  resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  disabled={replyText.trim().length < 3 || isSubmitting}
                  onClick={() => onSubmitReply(replyText.trim(), c.id)}
                  style={{
                    padding: '6px 16px', borderRadius: 999, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12,
                    cursor: replyText.trim().length < 3 ? 'not-allowed' : 'pointer',
                    opacity: replyText.trim().length < 3 ? 0.5 : 1,
                    fontFamily: 'var(--font)',
                  }}
                >
                  Отправить
                </button>
                <button
                  onClick={() => { onSetReplyingTo(null); onSetReplyText('') }}
                  style={{
                    padding: '6px 14px', borderRadius: 999,
                    border: '1px solid var(--border)', background: 'var(--white)',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12,
                    cursor: 'pointer', fontFamily: 'var(--font)',
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nested replies (depth 1 only) */}
      {depth === 0 && c.replies.length > 0 && (
        <div style={{ marginLeft: 24, borderLeft: '2px solid var(--border)', paddingLeft: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {c.replies.map((r, ri) => (
            <CommentCard
              key={r.id}
              comment={r}
              index={ri}
              articleId=""
              replyingTo={null}
              replyText=""
              onSetReplyingTo={() => {}}
              onSetReplyText={() => {}}
              onSubmitReply={() => {}}
              onReact={onReact}
              isSubmitting={false}
              depth={1}
            />
          ))}
        </div>
      )}
    </motion.div>
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
