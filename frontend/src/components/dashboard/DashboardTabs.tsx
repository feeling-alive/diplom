import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  dashboards: { id: string; name: string }[]
  activeId: string
  canAdd: boolean
  onSwitch: (id: string) => void
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 }

export default function DashboardTabs({ dashboards, activeId, canAdd, onSwitch, onAdd, onRemove }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleAdd = () => {
    onAdd(`Дашборд ${dashboards.length + 1}`)
  }

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove(id)
  }

  return (
    <div
      role="tablist"
      aria-label="Дашборды"
      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
    >
      {dashboards.map((d) => {
        const active = d.id === activeId
        const hovered = hoveredId === d.id

        return (
          <motion.div
            key={d.id}
            layout
            role="tab"
            aria-selected={active}
            title={d.name}
            animate={{
              width: active ? 40 : 12,
              background: active ? '#E11D48' : 'rgba(0,0,0,0.12)',
              boxShadow: active ? '0 0 8px rgba(225,29,72,0.4)' : 'none',
            }}
            transition={SPRING}
            onClick={() => onSwitch(d.id)}
            onMouseEnter={() => setHoveredId(d.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              height: 8,
              borderRadius: 999,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {active && hovered && dashboards.length > 1 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => handleRemove(d.id, e)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
              >
                <X size={8} strokeWidth={3} />
              </motion.span>
            )}
          </motion.div>
        )
      })}

      {/* Add button — always clickable; parent decides whether to add or show upgrade modal */}
      <motion.div
        title={canAdd ? 'Новый дашборд' : 'Достигнут лимит дашбордов'}
        animate={{ width: 12, background: 'rgba(0,0,0,0.10)' }}
        whileHover={{ width: 22, background: 'rgba(0,0,0,0.20)' }}
        transition={SPRING}
        onClick={handleAdd}
        style={{
          height: 8,
          borderRadius: 999,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: 8, lineHeight: 1, color: 'rgba(0,0,0,0.4)', userSelect: 'none' }}>+</span>
      </motion.div>
    </div>
  )
}
