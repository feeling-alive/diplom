// Profile hero: a full-width banner with a soft brand-coloured mesh gradient and
// floating blobs (animated via CSS classes, not framer-motion background props),
// an avatar overlapping the bottom edge, and the user's identity below.

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
  return (
    <div style={{ position: 'relative', marginBottom: 64 }}>
      {/* Banner */}
      <div
        style={{
          position: 'relative',
          height: 180,
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--accent-bg) 0%, var(--white) 70%)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="profile-blob profile-blob--a"
          style={{ width: 180, height: 180, top: -40, left: 40, background: 'rgba(225,29,72,0.28)' }}
        />
        <div
          className="profile-blob profile-blob--b"
          style={{ width: 140, height: 140, top: 20, right: 80, background: 'rgba(244,63,110,0.22)' }}
        />
        <div
          className="profile-blob profile-blob--c"
          style={{ width: 120, height: 120, bottom: -30, right: 200, background: 'rgba(255,193,90,0.25)' }}
        />
      </div>

      {/* Avatar overlapping the bottom edge */}
      <div style={{ position: 'absolute', left: 32, bottom: -50 }}>
        <AvatarUploader username={user.username} avatarUrl={user.avatar_url} onUpload={onUpload} />
      </div>

      {/* Identity block, offset right of the avatar */}
      <div style={{ paddingLeft: 148, paddingTop: 10, minHeight: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{user.username}</span>
          <span
            className="badge badge--accent-s"
            style={{ textTransform: 'capitalize' }}
          >
            {user.role}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{user.email}</div>
        <div style={{ fontSize: 11, color: 'var(--soft)', marginTop: 2 }}>
          {sinceLabel(user.created_at)}
        </div>
      </div>
    </div>
  )
}
