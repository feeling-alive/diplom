import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BarChart2, Users, Newspaper, BookMarked, PieChart, Sparkles } from 'lucide-react'

export type WidgetId = 'chart' | 'community' | 'news' | 'watchlist' | 'allocation' | 'personalized'

interface WidgetMeta {
  id: WidgetId
  label: string
  description: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
}

const WIDGETS: WidgetMeta[] = [
  { id: 'chart', label: 'График цены', description: 'Динамика актива с таймфреймами', Icon: BarChart2 },
  { id: 'community', label: 'Сообщество', description: 'Идеи и мнения трейдеров', Icon: Users },
  { id: 'news', label: 'Новости', description: 'Актуальные новости рынка', Icon: Newspaper },
  { id: 'watchlist', label: 'Вотчлист', description: 'Отслеживаемые активы', Icon: BookMarked },
  { id: 'allocation', label: 'Распределение', description: 'Доли портфеля по активам', Icon: PieChart },
  { id: 'personalized', label: 'Мои активы', description: 'Часто просматриваемые активы', Icon: Sparkles },
]

interface Props {
  open: boolean
  onClose: () => void
  enabledWidgets: WidgetId[]
  onApply: (ids: WidgetId[]) => void
}

export default function AddWidgetModal({ open, onClose, enabledWidgets, onApply }: Props) {
  const [selected, setSelected] = useState<Set<WidgetId>>(new Set(enabledWidgets))

  console.debug('[AddWidgetModal] open=', open, 'enabled=', [...selected])

  function toggle(id: WidgetId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleApply() {
    onApply([...selected])
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(13,13,13,0.4)',
              zIndex: 1000,
            }}
          />

          {/* Modal card */}
          <motion.div
            key="modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1001,
              background: 'var(--white)',
              borderRadius: 20,
              padding: 24,
              width: 400,
              maxWidth: '90vw',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                Управление виджетами
              </span>
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid var(--border)',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Widget grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {WIDGETS.map(({ id, label, description, Icon }) => {
                const active = selected.has(id)
                return (
                  <motion.div
                    key={id}
                    onClick={() => toggle(id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent-bg)' : 'var(--white)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <Icon
                      size={16}
                      strokeWidth={2}
                      color={active ? 'var(--accent)' : 'var(--muted)'}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3 }}>
                      {description}
                    </span>
                  </motion.div>
                )
              })}
            </div>

            {/* Apply button */}
            <motion.button
              whileHover={{ opacity: 0.9 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApply}
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Применить
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
