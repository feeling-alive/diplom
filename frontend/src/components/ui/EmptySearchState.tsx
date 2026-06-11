import { motion } from 'framer-motion'
import { SearchX } from 'lucide-react'

interface EmptySearchStateProps {
  message?: string
}

export function EmptySearchState({ message = 'Ничего не найдено' }: EmptySearchStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: 12,
      }}
    >
      <SearchX size={40} style={{ color: 'var(--soft)' }} />
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{message}</span>
    </motion.div>
  )
}
