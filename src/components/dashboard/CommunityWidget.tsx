import { motion } from 'framer-motion'
import { Heart, MessageCircle } from 'lucide-react'
import type { CommunityPost } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'
import { MOCK_COMMUNITY } from '../../mock/community.mock'

interface Props extends WidgetSizeProps {
  posts?: CommunityPost[]
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} д назад`
}

function truncate(text: string, max = 85): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

export default function CommunityWidget({ posts: propPosts, gridW = 2, gridH = 2 }: Props) {
  // Кол-во постов: 2×2 → 3, 2×3 → 4, 3×2 → 4, 3×3 → 6 (плотные строки, без растяжения отступов)
  const limit = gridH >= 3 ? (gridW >= 3 ? 6 : 4) : (gridW >= 3 ? 4 : 3)
  const posts = propPosts ?? MOCK_COMMUNITY.slice(0, limit)

  console.debug('[CommunityWidget] gridW=%d gridH=%d posts=%d', gridW, gridH, posts.length)

  if (posts.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Нет публикаций</span>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Идеи сообщества
        </span>
        <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>Смотреть все →</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {posts.map((post, idx) => {
        const isLast = idx === posts.length - 1
        const pillBg = post.author.avatarColor + '22'

        return (
          <motion.div
            key={post.id}
            whileHover={{ backgroundColor: 'var(--bg)', borderRadius: 10 }}
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 0',
              cursor: 'pointer',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: post.author.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {post.author.initials}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{post.author.handle} · {formatRelativeTime(post.createdAt)}
              </span>

              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>
                {truncate(post.content)}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: pillBg,
                    color: post.author.avatarColor,
                    borderRadius: 'var(--r-pill)',
                    fontSize: 9,
                    padding: '2px 7px',
                    fontWeight: 600,
                  }}
                >
                  {post.relatedAsset}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted)' }}>
                  <Heart size={11} strokeWidth={2} />
                  {post.likes}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted)' }}>
                  <MessageCircle size={11} strokeWidth={2} />
                  {post.comments}
                </span>
              </div>
            </div>
          </motion.div>
        )
      })}
      </div>
    </div>
  )
}
