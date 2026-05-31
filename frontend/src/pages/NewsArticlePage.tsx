import { useState } from 'react'
import { motion } from 'framer-motion'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useNews } from '../hooks/useNews'
import { ArrowLeft, Heart, HeartOff, MessageCircle, ThumbsUp, ThumbsDown, Clock } from 'lucide-react'

const MOCK_COMMENTS = [
  { id: 'c1', author: 'CryptoKing', text: 'Отличный анализ! Полностью согласен с выводами.', likes: 24, liked: false },
  { id: 'c2', author: 'TraderPro', text: 'Не совсем согласен. Рынок может развернуться в любой момент.', likes: 12, liked: false },
  { id: 'c3', author: 'Investor_42', text: 'Давно слежу за этим трендом. Статья подтверждает мою стратегию.', likes: 8, liked: false },
]

export default function NewsArticlePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { news } = useNews()
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [comments, setComments] = useState(MOCK_COMMENTS)
  const [newComment, setNewComment] = useState('')

  const article = news.find((n) => n.id === id)

  if (!article) {
    return (
      <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', color: 'var(--muted)' }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            Статья не найдена
          </h2>
          <Link to="/news" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            ← Вернуться к новостям
          </Link>
        </motion.div>
      </div>
    )
  }

  const isPositive = article.sentiment === 'positive'
  const isNegative = article.sentiment === 'negative'
  const dotColor = isPositive ? 'var(--green)' : isNegative ? 'var(--red)' : 'var(--soft)'

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    const newC = {
      id: `c-${Date.now()}`,
      author: 'Вы',
      text: newComment.trim(),
      likes: 0,
      liked: false,
    }
    setComments([newC, ...comments])
    setNewComment('')
  }

  function toggleLike(commentId: string) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, likes: c.liked ? c.likes - 1 : c.likes + 1, liked: !c.liked } : c,
      ),
    )
  }

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
          {/* Back button */}
          <button
            onClick={() => navigate('/news')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font)',
              marginBottom: 16,
              padding: 4,
            }}
          >
            <ArrowLeft size={16} />
            Назад к новостям
          </button>

          {/* Sentiment dot */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 8px ${dotColor}40`,
              marginBottom: 12,
            }}
          />

          {/* Title */}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--ink)',
              lineHeight: 1.3,
              marginBottom: 12,
            }}
          >
            {article.title}
          </h1>

          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} />
              {formatDate(article.publishedAt)}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                background: isPositive ? 'var(--accent-bg)' : isNegative ? 'rgba(232,38,74,0.1)' : 'var(--bg)',
                padding: '2px 10px',
                borderRadius: 'var(--r-pill)',
              }}
            >
              {article.source}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {isPositive ? '🟢 Позитивная' : isNegative ? '🔴 Негативная' : '⚪ Нейтральная'}
            </span>
          </div>

          {/* Full text */}
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: 'var(--text)',
              marginBottom: 32,
            }}
          >
            <p style={{ marginBottom: 12 }}>{article.summary}</p>
            <p style={{ marginBottom: 12, opacity: 0.85 }}>
              Полный текст статьи доступен по ссылке. Данные обновляются в реальном времени.
              Информация предоставляется исключительно в образовательных целях и не является
              инвестиционным советом.
            </p>
            <p style={{ opacity: 0.7, fontStyle: 'italic', fontSize: 12 }}>
              Связанные активы: {(article.relatedAssets || []).join(', ')}
            </p>
          </div>

          {/* Reactions */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 32,
              padding: '12px 16px',
              background: 'var(--bg)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <button
              onClick={() => {
                setLiked(!liked)
                if (disliked) setDisliked(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--r-pill)',
                border: liked ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: liked ? 'var(--accent-bg)' : 'var(--white)',
                color: liked ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {liked ? <ThumbsUp size={14} fill="var(--accent)" /> : <ThumbsUp size={14} />}
              Рекомендую
            </button>
            <button
              onClick={() => {
                setDisliked(!disliked)
                if (liked) setLiked(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--r-pill)',
                border: disliked ? '1px solid var(--red)' : '1px solid var(--border)',
                background: disliked ? 'rgba(232,38,74,0.1)' : 'var(--white)',
                color: disliked ? 'var(--red)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {disliked ? <ThumbsDown size={14} fill="var(--red)" /> : <ThumbsDown size={14} />}
              Не рекомендую
            </button>
            <button
              onClick={() => setLiked(!liked)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--border)',
                background: 'var(--white)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Heart size={14} />
              Сохранить
            </button>
          </div>

          {/* Comments section */}
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MessageCircle size={18} />
              Комментарии ({comments.length})
            </h3>

            {/* Comment form */}
            <form
              onSubmit={handleCommentSubmit}
              style={{ display: 'flex', gap: 8, marginBottom: 16 }}
            >
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  color: 'var(--text)',
                  background: 'var(--bg)',
                  outline: 'none',
                  fontFamily: 'var(--font)',
                }}
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--r-pill)',
                  background: newComment.trim() ? 'var(--accent)' : 'var(--border)',
                  color: '#fff',
                  border: 'none',
                  cursor: newComment.trim() ? 'pointer' : 'default',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                }}
              >
                Отправить
              </button>
            </form>

            {/* Comments list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {comment.author[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {comment.author}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--soft)' }}>·</span>
                      <button
                        onClick={() => toggleLike(comment.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          color: comment.liked ? 'var(--accent)' : 'var(--soft)',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {comment.liked ? (
                          <ThumbsUp size={12} fill="var(--accent)" />
                        ) : (
                          <ThumbsUp size={12} />
                        )}
                        {comment.likes}
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{comment.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}