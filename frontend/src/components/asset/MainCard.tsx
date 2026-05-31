import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, LineChart, Info } from 'lucide-react'
import SimpleChart from './SimpleChart'
import CoinInfoBlock from './CoinInfoBlock'
import TradingViewModal from './TradingViewModal'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

type TabKey = 'simple' | 'info'

interface Tab {
  key: TabKey
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { key: 'simple', label: 'Обычный',             icon: <LineChart size={13} strokeWidth={2} /> },
  { key: 'info',   label: 'Информация о монете', icon: <Info size={13} strokeWidth={2} /> },
]

export default function MainCard({ asset }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('simple')
  const [isProModalOpen, setIsProModalOpen] = useState(false)

  console.debug('[MainCard] activeTab=%s modalOpen=%s', activeTab, isProModalOpen)

  return (
    <div style={{ position: 'relative' }}>
      {/* Tabs row — "выступают" вверх, активный сливается с карточкой */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginLeft: 16,
        position: 'relative',
        zIndex: 2,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => {
                console.debug('[MainCard] tab click: %s', tab.key)
                setActiveTab(tab.key)
              }}
              style={{
                position: 'relative',
                top: 1,
                padding: '8px 16px 12px',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                border: '1px solid var(--border)',
                borderBottom: isActive ? '1px solid var(--white)' : '1px solid var(--border)',
                background: isActive ? 'var(--white)' : 'var(--bg)',
                color: isActive ? 'var(--ink)' : 'var(--muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'background 0.2s, color 0.2s',
                zIndex: isActive ? 3 : 1,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}

        {/* "Про график" tab — opens modal */}
        <button
          onClick={() => {
            console.debug('[MainCard] opening pro modal')
            setIsProModalOpen(true)
          }}
          style={{
            position: 'relative',
            top: 1,
            padding: '8px 16px 12px',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            border: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.2s',
            zIndex: 1,
          }}
        >
          <ExternalLink size={13} strokeWidth={2} />
          Про график
        </button>
      </div>

      {/* Card content */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        borderTopLeftRadius: 0,
        padding: '20px 22px',
        minHeight: 420,
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        zIndex: 2,
      }}>
        <AnimatePresence mode="wait">
          {activeTab === 'simple' && (
            <motion.div
              key="simple"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SimpleChart symbol={asset.symbol} change24h={asset.change24h} />
            </motion.div>
          )}

          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <CoinInfoBlock symbol={asset.symbol} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TradingViewModal
        open={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
        asset={asset}
      />
    </div>
  )
}
