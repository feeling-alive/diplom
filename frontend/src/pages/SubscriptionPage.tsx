// Standalone /subscription page. Refactored off localStorage onto the backend
// via useSubscription + the shared SubscriptionCard (same source of truth as the
// profile page). No emoji, prices in ₽.

import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { SubscriptionCard } from '../components/ui/SubscriptionCard'

export default function SubscriptionPage() {
  const navigate = useNavigate()
  const { data, isLoading, error, busy, upgradeToPremium, cancel } = useSubscription()

  console.debug('[SubscriptionPage] render', data?.plan)

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 560,
          margin: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '24px 0',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', marginBottom: 16, padding: 4,
          }}
        >
          <ChevronLeft size={16} />
          Назад
        </button>

        <div
          style={{
            background: 'var(--white)',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg)',
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4, textAlign: 'center' }}>
            Подписка
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, textAlign: 'center' }}>
            Выберите план, который подходит вам лучше всего
          </p>

          {isLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 16 }}>
              {error ? 'Не удалось загрузить подписку' : 'Загрузка…'}
            </div>
          ) : (
            <SubscriptionCard
              status={data}
              onUpgrade={upgradeToPremium}
              onCancel={cancel}
              busy={busy}
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}
