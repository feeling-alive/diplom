import { motion } from 'framer-motion'
import { Search, AlignLeft, Plus, RotateCcw } from 'lucide-react'

interface Props {
  onOpenWidgetMenu?: () => void
  onOpenPicker?: () => void
  onResetLayout?: () => void
  addButtonRef?: React.RefObject<HTMLButtonElement>
}

export default function DashboardHeader({ onOpenWidgetMenu, onOpenPicker, onResetLayout, addButtonRef }: Props) {
  console.debug('[DashboardHeader] render')

  const handleAddWidget = onOpenWidgetMenu || onOpenPicker || (() => {})

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        padding: '0 4px',
        gap: 12,
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left — search */}
      <div
        className="dashboard-search"
        style={{
          flex: 1,
          maxWidth: 320,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg)',
          borderRadius: 999,
          padding: '10px 16px',
          border: '1px solid var(--border)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <Search size={16} strokeWidth={2} color="var(--muted)" style={{ flexShrink: 0 }} />
        <input
          placeholder="Поиск активов..."
          className="search-input"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text)',
            fontFamily: 'var(--font)',
          }}
        />
      </div>

      {/* Right — actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Reset layout */}
        {onResetLayout && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (window.confirm('Сбросить раскладку дашборда к стандартной?')) {
                onResetLayout()
              }
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--white)',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Сбросить раскладку"
            title="Сбросить раскладку к стандартной"
          >
            <RotateCcw size={14} strokeWidth={2} />
          </motion.button>
        )}

        {/* Menu */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Меню"
        >
          <AlignLeft size={14} strokeWidth={2} />
        </motion.button>

        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Профиль"
        >
          П
        </div>

        {/* Plus (add widget) */}
        <motion.button
          ref={addButtonRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAddWidget}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          aria-label="Добавить виджет"
        >
          <Plus size={14} strokeWidth={2.5} />
        </motion.button>
      </div>
    </header>
  )
}
