import { motion } from 'framer-motion'
import { Heart, MessageCircle } from 'lucide-react'
import type { CommunityPost } from '../../types/market.types'
import { MOCK_COMMUNITY } from '../../mock/community.mock'

interface Props {
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

export default function CommunityWidget({ posts = MOCK_COMMUNITY.slice(0, 3) }: Props) {
  console.debug('[CommunityWidget] rendered', posts.length, 'posts')

  if (posts.length === 0) {
    return (
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 120,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Нет публикаций</span>
      </div>
    )
  }

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Идеи сообщества
        </span>
        <span style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
          Смотреть все →
        </span>
      </div>

      {/* Posts */}
      {posts.map((post, idx) => {
        const isLast = idx === posts.length - 1
        // Semi-transparent tint for asset pill background
        const pillBg = post.author.avatarColor + '22'

        return (
          <motion.div
            key={post.id}
            whileHover={{ backgroundColor: 'var(--bg)', borderRadius: 10 }}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 0',
              cursor: 'pointer',
              borderBottom: isLast ? 'none' : '1px solid var(--border)',
            }}
          >
            {/* Avatar */}
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

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              {/* Handle + time */}
              <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                @{post.author.handle} · {formatRelativeTime(post.createdAt)}
              </span>

              {/* Post text */}
              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>
                {truncate(post.content)}
              </p>

              {/* Footer: asset tag + stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
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
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    color: 'var(--muted)',
                  }}
                >
                  <Heart size={11} strokeWidth={2} />
                  {post.likes}
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    color: 'var(--muted)',
                  }}
                >
                  <MessageCircle size={11} strokeWidth={2} />
                  {post.comments}
                </span>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
