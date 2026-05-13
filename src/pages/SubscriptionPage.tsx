import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Crown, Check, Zap, Lock, Star, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PLANS = [
  {
    id: 'free',
    name: 'Бесплатный',
    price: '0₽',
    period: 'навсегда',
    features: [
      '5 AI-запросов в день',
      'Базовый дашборд',
      '3 виджета одновременно',
      'Задержка данных 15 мин',
      'Стандартные алерты',
      '1 актив в тутч-листе',
    ],
    popular: false,
  },
  {
    id: 'premium',
    name: 'Премиум',
    price: '999₽',
    period: '/мес',
    features: [
      'Неограниченные AI-запросы',
      'Расширенный дашборд',
      'Все 6 виджетов',
      'Данные в реальном времени',
      'Продвинутые алерты',
      'До 20 активов в тутч-листе',
      'Экспорт данных',
      'Приоритетная поддержка',
    ],
    popular: true,
  },
]

export default function SubscriptionPage() {
  const navigate = useNavigate()
  const [currentPlan, setCurrentPlan] = useState('free')
  const [animating, setAnimating] = useState<string | null>(null)

  const currentStoredPlan = localStorage.getItem('fintrack_plan') || 'free'

  function handleUpgrade(planId: string) {
    setAnimating(planId)
    setTimeout(() => {
      localStorage.setItem('fintrack_plan', planId)
      setCurrentPlan(planId)
      setAnimating(null)
    }, 600)
  }

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 800,
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
            ⭐ Подписка
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, textAlign: 'center' }}>
            Выберите план, который подходит вам лучше всего
          </p>

          {/* Current plan banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: currentStoredPlan === 'premium'
                ? 'linear-gradient(135deg, rgba(255,193,7,0.15), rgba(232,38,74,0.05))'
                : 'var(--bg)',
              border: `1px solid ${currentStoredPlan === 'premium' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              padding: '12px 16px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: currentStoredPlan === 'premium' ? 'var(--accent)' : 'var(--muted)',
              fontWeight: 500,
            }}
          >
            <Crown size={18} />
            Текущий план: <strong>{currentStoredPlan === 'premium' ? 'Премиум' : 'Бесплатный'}</strong>
          </motion.div>

          {/* Plans grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            {PLANS.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index + 0.2 }}
                whileHover={{ scale: 1.03, y: -2 }}
                onClick={() => handleUpgrade(plan.id)}
                style={{
                  borderRadius: 'var(--r-lg)',
                  padding: '24px 20px',
                  background: plan.popular ? 'var(--accent-bg)' : 'var(--white)',
                  border: `2px solid ${plan.popular ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  opacity: animating === plan.id ? 0.5 : 1,
                  transform: animating === plan.id ? 'scale(0.97)' : 'none',
                }}
              >
                {plan.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--accent)',
                      color: '#fff',
                      padding: '3px 12px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Star size={12} fill="#fff" />
                    ПОПУЛЯРНЫЙ
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: plan.popular ? 'var(--accent)' : 'var(--muted)',
                    marginBottom: 8,
                  }}
                >
                  {plan.name}
                </div>

                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 800,
                      color: 'var(--ink)',
                      lineHeight: 1,
                    }}
                  >
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>
                    {plan.period}
                  </span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Check size={14} color={plan.popular ? 'var(--accent)' : 'var(--green)'} fill={plan.popular ? 'var(--accent)' : 'var(--green)'} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {currentStoredPlan !== plan.id && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      borderRadius: 'var(--r-pill)',
                      background: plan.popular ? 'var(--accent)' : 'var(--ink)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font)',
                      marginTop: 16,
                      transition: 'opacity 0.15s',
                      opacity: animating === plan.id ? 0.5 : 1,
                      pointerEvents: animating === plan.id ? 'none' : 'auto',
                    }}
                  >
                    {currentStoredPlan === 'free' ? `Перейти на ${plan.name}` : 'Активировать'}
                  </motion.button>
                )}

                {currentStoredPlan === plan.id && (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--bg)',
                      color: 'var(--green)',
                      border: '1px solid var(--green)',
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font)',
                      marginTop: 16,
                    }}
                  >
                    ✓ Текущий план
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}