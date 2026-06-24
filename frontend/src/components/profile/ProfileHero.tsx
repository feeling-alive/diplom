// Profile hero: a full-width gradient banner with the avatar overlapping
// the bottom edge and the user's identity (name + email) displayed on the banner.
// Static gradient — no animated blobs.

import { AvatarUploader } from './AvatarUploader'

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

function sinceLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `С нами с ${RU_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export interface ProfileHeroUser {
  username: string
  email: string
  role: string
  avatar_url: string | null
  created_at: string
}

export interface ProfileHeroProps {
  user: ProfileHeroUser
  onUpload: (file: File) => Promise<string>
}

export function ProfileHero({ user, onUpload }: ProfileHeroProps) {
  console.debug('[ProfileHero] render username=%s', user.username)

  // Приложение всегда светлое (round 3) — баннер со светлым градиентом.
  const bannerGradient = 'linear-gradient(135deg, #fdf2f5 0%, #fce7ed 50%, #f9d0da 100%)'

  return (
    <div style={{ position: 'relative', marginBottom: 56 }}>
      {/* Banner — theme-aware gradient, no overflow:hidden so avatar can overhang */}
      <div
        style={{
          position: 'relative',
          height: 180,
          borderRadius: 'var(--r-xl)',
          background: bannerGradient,
          border: '1px solid var(--border)',
        }}
      >
        {/* Avatar overlapping the bottom edge */}
        <div style={{ position: 'absolute', bottom: -40, left: 24 }}>
          <AvatarUploader
            username={user.username}
            avatarUrl={user.avatar_url}
            onUpload={onUpload}
            size={80}
          />
        </div>

        {/* Identity: name + email on the banner, to the right of the avatar */}
        <div style={{ position: 'absolute', bottom: 20, left: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
              {user.username}
            </span>
            <span
              className="badge badge--accent-s"
              style={{
                textTransform: 'capitalize',
                background: 'rgba(0,0,0,0.08)',
                color: 'var(--ink)',
                borderColor: 'rgba(0,0,0,0.12)',
              }}
            >
              {user.role}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {user.email}
          </div>
          <div style={{ fontSize: 11, color: 'var(--soft, var(--muted))', marginTop: 2 }}>
            {sinceLabel(user.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}
