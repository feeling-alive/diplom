import { Search, AlignLeft, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  onAddWidget?: () => void
}

export default function DashboardTopBar({ onAddWidget }: Props) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0 14px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 4,
      }}
    >
      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg)',
          borderRadius: 'var(--r-pill)',
          padding: '6px 14px',
          width: 220,
        }}
      >
        <Search size={14} strokeWidth={2} color="var(--muted)" />
        <input
          placeholder="Поиск активов..."
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 12,
            color: 'var(--text)',
            width: '100%',
            fontFamily: 'var(--font)',
          }}
        />
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted)',
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
          }}
        >
          П
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddWidget}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--ink)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
          }}
          aria-label="Добавить виджет"
        >
          <Plus size={14} strokeWidth={2.5} />
        </motion.button>
      </div>
    </header>
  )
}
