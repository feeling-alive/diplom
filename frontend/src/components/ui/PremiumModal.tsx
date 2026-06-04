import { AnimatePresence, motion } from 'framer-motion'
import { Crown, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PremiumModalProps {
  open: boolean
  onClose: () => void
  dashboardLimit: number
}

const PREMIUM_FEATURES = [
  'До 5 кастомных дашбордов',
  'Безлимитный ИИ-ассистент',
  'Значок Premium в профиле',
  'Безлимитные запросы к ИИ',
]

export function PremiumModal({ open, onClose, dashboardLimit }: PremiumModalProps) {
  const navigate = useNavigate()
  console.debug('[PremiumModal] open=%s dashboardLimit=%d', open, dashboardLimit)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="premium-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            key="premium-card"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              position: 'relative',
              background: 'var(--white)', borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-lg)', padding: 32,
              maxWidth: 380, width: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}
          >
            {/* Close button — only way to dismiss */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4, borderRadius: 6,
              }}
              title="Закрыть"
            >
              <X size={16} />
            </button>

            {/* Crown */}
            <div
              style={{
                width: 56, height: 56, borderRadius: 999,
                background: 'linear-gradient(135deg, #FFD25A 0%, #F5A623 100%)',
                boxShadow: '0 0 0 6px rgba(245,166,35,0.15), 0 8px 24px -6px rgba(245,166,35,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Crown size={26} color="#fff" />
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                Нужен Premium
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Вы достигли лимита дашбордов<br />
                (максимум {dashboardLimit} на Free-плане)
              </p>
            </div>

            {/* Feature list */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
                  <span style={{ color: '#F5A623', fontSize: 14, lineHeight: 1 }}>★</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>990₽</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ месяц</span>
              <span style={{ fontSize: 13, color: 'var(--soft, var(--muted))', textDecoration: 'line-through', marginLeft: 4 }}>
                1499₽
              </span>
            </div>

            {/* CTA */}
            <motion.button
              className="sub-shimmer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { onClose(); navigate('/subscription') }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 'var(--r-pill)',
                fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Crown size={16} color="#fff" />
              Перейти на Premium
            </motion.button>

            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font)',
              }}
            >
              Остаться на Free
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
