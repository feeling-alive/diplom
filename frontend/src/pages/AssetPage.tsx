import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AssetHeader from '../components/asset/AssetHeader'
import MainCard from '../components/asset/MainCard'
import MetricsBar from '../components/asset/MetricsBar'
import NewsPanel from '../components/asset/NewsPanel'
import { usePrices } from '../hooks/usePrices'

export default function AssetPage() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()
  const { bySymbol } = usePrices()

  const asset = symbol ? bySymbol[symbol] : undefined

  console.debug('[AssetPage] symbol=%s found=%s', symbol, !!asset)

  if (!asset) {
    return (
      <div className="main-content" style={{ flex: 1 }}>
        <div
          className="main-scroll"
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minHeight: '70vh',
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--border)' }}>404</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
            Актив не найден
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            «{symbol}» отсутствует в списке активов
          </div>
          <button
            onClick={() => navigate('/market')}
            style={{
              marginTop: 12,
              padding: '8px 20px',
              background: 'var(--ink)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
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
    <div className="main-content" style={{ flex: 1 }}>
      <motion.div
        className="main-scroll"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ padding: '20px 24px 24px' }}
      >
        <AssetHeader asset={asset} />

        {/* Two-column body */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 65fr) minmax(0, 35fr)',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* LEFT column */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <MainCard asset={asset} />
            <MetricsBar asset={asset} />
          </div>

          {/* RIGHT column */}
          <div style={{
            height: 'calc(420px + 16px + 100px)',
            minHeight: 540,
          }}>
            <NewsPanel symbol={asset.symbol} ticker={asset.symbol} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
