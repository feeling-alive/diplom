import { motion } from 'framer-motion'

interface Props {
  w: number
  h: number
}

export default function SizeIndicator({ w, h }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{
        position: 'absolute',
        top: -28,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--white)',
        borderRadius: 999,
        padding: '3px 12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        zIndex: 20,
        pointerEvents: 'none',
        fontFamily: 'var(--font)',
      }}
    >
      {w} × {h}
    </motion.div>
  )
}
