// Dashboard carousel (Задача 7b): name pills with a sliding active indicator
// (framer-motion layoutId), a «+» to add (disabled at the 5-dashboard cap, asks
// for a name) and a per-tab «×» to delete (confirmation, hidden when only one
// dashboard remains). Design-system colors only.

import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'

interface Props {
  dashboards: { id: string; name: string }[]
  activeId: string
  canAdd: boolean
  onSwitch: (id: string) => void
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}

export default function DashboardTabs({ dashboards, activeId, canAdd, onSwitch, onAdd, onRemove }: Props) {
  const handleAdd = () => {
    const name = window.prompt('Название нового дашборда:', `Дашборд ${dashboards.length + 1}`)
    if (name !== null) onAdd(name)
  }

  const handleRemove = (id: string, name: string) => {
    if (window.confirm(`Удалить дашборд «${name}»?`)) onRemove(id)
  }

  return (
    <div
      role="tablist"
      aria-label="Дашборды"
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 10px', flexWrap: 'wrap' }}
    >
      {dashboards.map((d) => {
        const active = d.id === activeId
        return (
          <div key={d.id} style={{ position: 'relative' }}>
            <button
              role="tab"
              aria-selected={active}
              onClick={() => onSwitch(d.id)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                paddingRight: dashboards.length > 1 ? 26 : 12,
                border: '1px solid var(--border)',
                borderRadius: 999,
                background: active ? 'var(--white)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {active && (
                <motion.span
                  layoutId="dashboard-tab-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 999, zIndex: 0,
                    border: '1px solid var(--accent)', boxShadow: 'var(--shadow-sm)',
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{d.name}</span>
            </button>

            {dashboards.length > 1 && (
              <button
                aria-label={`Удалить ${d.name}`}
                onClick={() => handleRemove(d.id, d.name)}
                style={{
                  position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
                  zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, padding: 0, border: 'none', borderRadius: 999,
                  background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )
      })}

      <button
        aria-label="Добавить дашборд"
        title={canAdd ? 'Добавить дашборд' : 'Достигнут лимит в 5 дашбордов'}
        onClick={handleAdd}
        disabled={!canAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 999, border: '1px dashed var(--border)',
          background: 'transparent', color: 'var(--muted)',
          cursor: canAdd ? 'pointer' : 'not-allowed', opacity: canAdd ? 1 : 0.4,
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}
