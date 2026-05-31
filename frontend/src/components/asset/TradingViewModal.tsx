import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bot, TrendingUp, Activity, ShieldAlert } from 'lucide-react'
import type { Asset } from '../../types/market.types'

interface Props {
  open: boolean
  onClose: () => void
  asset: Asset
}

// Map our internal symbol → TradingView symbol
function toTradingViewSymbol(asset: Asset): string {
  if (asset.type === 'crypto') {
    // BTC-USDT → BINANCE:BTCUSDT
    const base = asset.symbol.split('-')[0]
    return `BINANCE:${base}USDT`
  }
  if (asset.type === 'stock') {
    // Default to NASDAQ — works for most majors
    return `NASDAQ:${asset.symbol}`
  }
  if (asset.type === 'forex') {
    // EUR-USD → FX:EURUSD
    const pair = asset.symbol.replace('-', '')
    return `FX:${pair}`
  }
  return asset.symbol
}

function buildTvUrl(symbol: string): string {
  const params = new URLSearchParams({
    symbol,
    interval: 'D',
    theme: 'light',
    locale: 'ru',
    style: '1',
    timezone: 'Etc/UTC',
    hide_side_toolbar: 'false',
    allow_symbol_change: 'false',
    enable_publishing: 'false',
    backgroundColor: '#FFFFFF',
    withdateranges: 'true',
    hide_volume: 'false',
    hideideas: 'true',
  })
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`
}

const SUGGESTIONS = [
  { icon: <TrendingUp size={13} />, label: 'Проанализируй текущий тренд' },
  { icon: <Activity size={13} />,   label: 'Найди уровни поддержки' },
  { icon: <ShieldAlert size={13} />, label: 'Оцени риски входа' },
]

export default function TradingViewModal({ open, onClose, asset }: Props) {
  const tvSymbol = toTradingViewSymbol(asset)
  const tvUrl = buildTvUrl(tvSymbol)

  console.debug('[TradingViewModal] open=%s symbol=%s tvSymbol=%s', open, asset.symbol, tvSymbol)

  // Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '92vw',
              height: '90vh',
              maxWidth: 1600,
              maxHeight: 1000,
              background: 'var(--white)',
              borderRadius: 20,
              boxShadow: '0 40px 80px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '7fr 3fr',
            }}
          >
            {/* Chart area */}
            <div style={{ position: 'relative', borderRight: '1px solid var(--border)' }}>
              <iframe
                key={tvSymbol}
                src={tvUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                }}
                title={`TradingView chart for ${tvSymbol}`}
                allow="fullscreen"
              />
            </div>

            {/* AI panel */}
            <div style={{
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              background: 'linear-gradient(180deg, var(--bg) 0%, var(--white) 60%)',
              position: 'relative',
            }}>
              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid var(--border)',
                  background: 'var(--white)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <X size={14} strokeWidth={2} color="var(--muted)" />
              </button>

              {/* Header */}
              <div style={{ marginTop: 10 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Bot size={24} color="var(--accent)" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                  ИИ-ассистент
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Подключение к аналитической модели — следующий этап
                </div>
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    disabled
                    style={{
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--muted)',
                      cursor: 'not-allowed',
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: 0.6,
                    }}
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }} />

              {/* Disabled input */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--soft)',
                fontSize: 12,
                opacity: 0.6,
                cursor: 'not-allowed',
              }}>
                Задайте вопрос об активе...
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
