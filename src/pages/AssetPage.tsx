import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import NavBar from '../components/layout/FinTrackNavBar'
import AssetHeader from '../components/asset/AssetHeader'
import CandlestickChart from '../components/asset/CandlestickChart'
import ChatPanel from '../components/asset/ChatPanel'
import { MOCK_PRICES } from '../mock/prices.mock'

export default function AssetPage() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()

  const asset = MOCK_PRICES.find(a => a.symbol === symbol)

  console.debug('[AssetPage] symbol=', symbol, 'found=', !!asset)

  if (!asset) {
    return (
      <div className="app-page">
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--white)',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--border)' }}>404</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            Актив не найден
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            «{symbol}» отсутствует в списке активов
          </div>
          <button
            onClick={() => navigate('/market')}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              background: 'var(--ink)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Вернуться к рынку
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--white)',
          borderRadius: 22,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 22px 22px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          } as React.CSSProperties}
        >
          <NavBar />
          <AssetHeader asset={asset} />

          {/* Chart + AI chat */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 2fr',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <CandlestickChart symbol={asset.symbol} />
            <ChatPanel asset={asset} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
