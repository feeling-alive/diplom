import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bot, TrendingUp, Activity, ShieldAlert, Send, TrendingDown, Minus } from 'lucide-react'
import { useGroqChat } from '../../hooks/useGroqChat'
import type { Asset } from '../../types/market.types'

interface Props {
  open: boolean
  onClose: () => void
  asset: Asset
}

// Per-coin exchange override for TradingView. Most majors trade as BINANCE:<base>USDT,
// but some pairs are absent/delisted on Binance — route those to an exchange that
// reliably lists them so the embed doesn't show "Invalid symbol".
const CRYPTO_EXCHANGE: Record<string, string> = {
  FTM: 'KUCOIN',   // delisted on Binance (rebranded to S)
  STX: 'KUCOIN',
}

function toTradingViewSymbol(asset: Asset): string {
  if (asset.type === 'crypto') {
    const base = asset.symbol.split('-')[0]!.toUpperCase()
    const exchange = CRYPTO_EXCHANGE[base] ?? 'BINANCE'
    return `${exchange}:${base}USDT`
  }
  if (asset.type === 'stock') {
    return `NASDAQ:${asset.symbol}`
  }
  if (asset.type === 'forex') {
    const pair = asset.symbol.replace('-', '')
    return `FX:${pair}`
  }
  return asset.symbol
}

function buildTvUrl(symbol: string): string {
  const params = new URLSearchParams({
    symbol,
    // Default to the 1H ("60") timeframe. The iframe lives inside `{open && ...}`
    // within AnimatePresence, so it unmounts on close and remounts on every open
    // — this default therefore applies each time the "Про график" tab is opened.
    interval: '60',
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

// Badge shows direction only — no percentages (numbers read as false precision).
function PredictionBadge({ direction }: { direction: string }) {
  const color = direction === 'UP' ? '#16a34a' : direction === 'DOWN' ? '#dc2626' : '#6b7280'
  const Icon = direction === 'UP' ? TrendingUp : direction === 'DOWN' ? TrendingDown : Minus
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8,
      background: `${color}15`, color, fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={14} />
      {direction === 'UP' ? 'Вверх' : direction === 'DOWN' ? 'Вниз' : 'Нейтрально'}
    </div>
  )
}

export default function TradingViewModal({ open, onClose, asset }: Props) {
  const tvSymbol = toTradingViewSymbol(asset)
  const tvUrl = buildTvUrl(tvSymbol)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const inputRef = useRef<HTMLTextAreaElement>(null!)

  const { messages, loading, error, prediction, send } = useGroqChat({
    symbol: asset.symbol,
  })

  console.debug('[TradingViewModal] open=%s symbol=%s tvSymbol=%s interval=60', open, asset.symbol, tvSymbol)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Plain handlers: React Compiler memoizes automatically, and a manual
  // useCallback here could not preserve its inferred deps (react-hooks rule).
  const handleSend = () => {
    if (!input.trim() || loading) return
    send(input.trim())
    setInput('')
  }

  const handlePromptClick = (text: string) => {
    send(text)
  }

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              width: '92vw', height: '90vh', maxWidth: 1600, maxHeight: 1000,
              background: 'var(--white)', borderRadius: 20,
              boxShadow: '0 40px 80px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'grid', gridTemplateColumns: '7fr 3fr',
            }}
          >
            {/* Chart area */}
            <div style={{ position: 'relative', borderRight: '1px solid var(--border)' }}>
              <iframe
                key={tvSymbol}
                src={tvUrl}
                style={{
                  width: '100%', height: '100%', border: 'none', display: 'block',
                }}
                title={`TradingView chart for ${tvSymbol}`}
                allow="fullscreen"
              />
            </div>

            {/* AI panel */}
            <div style={{
              padding: '24px 22px',
              display: 'flex', flexDirection: 'column', gap: 12,
              background: 'linear-gradient(180deg, var(--bg) 0%, var(--white) 60%)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 32, height: 32, borderRadius: '50%',
                  border: '1px solid var(--border)', background: 'var(--white)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', zIndex: 2,
                }}
              >
                <X size={14} strokeWidth={2} color="var(--muted)" />
              </button>

              {/* Header */}
              <div style={{ marginTop: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: 'var(--accent-bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                }}>
                  <Bot size={24} color="var(--accent)" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                  ИИ-ассистент
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Анализ актива {asset.symbol}
                </div>
                {prediction && (
                  <div style={{ marginTop: 8 }}>
                    <PredictionBadge direction={prediction.direction} />
                  </div>
                )}
              </div>

              {/* Chat messages */}
              <div style={{
                flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
                minHeight: 0, scrollbarWidth: 'thin',
              }}>
                {messages.length === 0 ? (
                  // Suggestions
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {SUGGESTIONS.map((s) => (
                      <motion.button
                        key={s.label}
                        // No scale on hover — the panel is overflow:hidden, so a scaled
                        // block was clipped / pushed past the frame (bug #10). Use a
                        // contained highlight (border + background) instead.
                        whileHover={{ borderColor: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePromptClick(s.label)}
                        style={{
                          padding: '11px 14px', borderRadius: 12,
                          border: '1px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--ink)', cursor: 'pointer', fontSize: 12,
                          fontWeight: 500, textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontFamily: 'var(--font)',
                        }}
                      >
                        {s.icon}
                        {s.label}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                          gap: 8, alignItems: 'flex-start',
                        }}
                      >
                        <div style={{
                          maxWidth: '85%', padding: '8px 12px',
                          borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                          background: msg.role === 'user' ? 'var(--accent)' : 'var(--white)',
                          color: msg.role === 'user' ? '#fff' : 'var(--text)',
                          fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                          border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)',
                          animation: 'pulse 0.6s infinite',
                        }} />
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Анализирую...</div>
                      </div>
                    )}
                    {error && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 10,
                        background: 'var(--neg-bg)', color: 'var(--neg)', fontSize: 11,
                      }}>
                        {error}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-end',
                background: 'var(--bg)', borderRadius: 12,
                padding: '6px 6px 6px 12px', border: '1px solid var(--border)',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Задайте вопрос об активе..."
                  rows={1}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font)',
                    resize: 'none', maxHeight: 80, lineHeight: 1.5,
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
                    color: '#fff', border: 'none',
                    cursor: input.trim() && !loading ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <Send size={13} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
