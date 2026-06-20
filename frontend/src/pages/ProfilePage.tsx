// Profile page — composition root for the profile feature. Light "Hero + edit
// card" layout in the project design system (no MUI). Orchestrates useProfile and
// wires avatar/username edits back into the auth context so the sidebar/header
// update instantly. (Subscription/premium removed — see plan task 7.)

import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { ProfileHero } from '../components/profile/ProfileHero'
import { ProfileEditCard } from '../components/profile/ProfileEditCard'

export default function ProfilePage() {
  const { updateUser } = useAuth()
  const profile = useProfile()

  console.debug('[ProfilePage] render', profile.data?.username)

  // Upload avatar, then mirror the new URL into the auth context (sidebar/header).
  async function handleUpload(file: File): Promise<string> {
    const url = await profile.uploadAvatar(file)
    updateUser({ avatar_url: url })
    return url
  }

  async function handleSaveUsername(username: string): Promise<void> {
    const updated = await profile.updateUsername(username)
    updateUser({ username: updated.username })
  }

  if (profile.isLoading || !profile.data) {
    return (
      <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>
        {profile.error ? 'Не удалось загрузить профиль' : 'Загрузка профиля…'}
      </div>
    )
  }

  const user = profile.data

  return (
    <div style={{ minHeight: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 880, margin: '0 auto', padding: '20px 24px 32px' }}
      >
        <ProfileHero user={user} onUpload={handleUpload} />

        <ProfileEditCard
          currentUsername={user.username}
          email={user.email}
          createdAt={user.created_at}
          usernameCheck={profile.usernameCheck}
          onUsernameInput={profile.checkUsernameDebounced}
          onSave={handleSaveUsername}
        />
      </motion.div>
    </div>
  )
}
