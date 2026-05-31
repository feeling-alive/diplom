import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

interface Props {
  onOpenPicker: () => void
}

export default function EmptyDashboard({ onOpenPicker }: Props) {
  return (
    <motion.div
      className="empty-dashboard"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Анимированные "призрачные" окна виджетов */}
      <div className="empty-ghost-widgets">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="ghost-widget"
            animate={{
              y: [0, -8 - i * 3, 0],
              rotate: [-1 + i, 1 - i, -1 + i],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.3,
            }}
            style={{
              opacity: 0.06 + i * 0.02,
              transform: `translateX(${(i - 1) * 60}px) rotate(${(i - 1) * 3}deg)`,
            }}
          />
        ))}
      </div>

      {/* Анимированный курсор мыши */}
      <motion.div
        className="empty-cursor"
        animate={{
          x: [0, 40, 20, 60, 30],
          y: [0, -20, 10, -10, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      </motion.div>

      <div className="empty-text">
        <motion.h3
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Добавь свой первый виджет
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Персонализируй дашборд под свои интересы
        </motion.p>
        <motion.button
          className="empty-cta"
          onClick={onOpenPicker}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: 'spring' }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} /> Добавить виджет
        </motion.button>
      </div>
    </motion.div>
  )
}