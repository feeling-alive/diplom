// Profile page — composition root for the profile + subscription feature. Light
// "Hero + 2 cards" layout in the project design system (no MUI). Orchestrates
// useProfile + useSubscription and wires avatar/username edits back into the auth
// context so the sidebar/header update instantly.

import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { useSubscription } from '../hooks/useSubscription'
import { ProfileHero } from '../components/profile/ProfileHero'
import { ProfileEditCard } from '../components/profile/ProfileEditCard'
import { SubscriptionCard } from '../components/ui/SubscriptionCard'

export default function ProfilePage() {
  const { updateUser } = useAuth()
  const profile = useProfile()
  const subscription = useSubscription()

  console.debug('[ProfilePage] render', profile.data?.username, subscription.data?.plan)

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

  // Refresh both profile (ai_requests/limit + plan) and subscription status.
  async function refreshAll(): Promise<void> {
    await Promise.all([profile.refetch(), subscription.refetch()])
  }

  async function handleUpgrade(): Promise<void> {
    await subscription.upgradeToPremium()
    await refreshAll()
  }

  async function handleCancel(): Promise<void> {
    await subscription.cancel()
    await refreshAll()
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
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 880, margin: '0 auto', padding: '20px 24px 32px' }}
      >
        <ProfileHero user={user} onUpload={handleUpload} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}
        >
          <ProfileEditCard
            currentUsername={user.username}
            email={user.email}
            createdAt={user.created_at}
            usernameCheck={profile.usernameCheck}
            onUsernameInput={profile.checkUsernameDebounced}
            onSave={handleSaveUsername}
          />

          <div
            style={{
              background: 'var(--white)', borderRadius: 22,
              boxShadow: 'var(--shadow-lg)', padding: 28,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
              Подписка
            </h2>
            <SubscriptionCard
              status={subscription.data}
              onUpgrade={handleUpgrade}
              onCancel={handleCancel}
              busy={subscription.busy}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
