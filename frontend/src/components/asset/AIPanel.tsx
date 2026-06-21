import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, TrendingUp, Activity, ShieldAlert, Send, TrendingDown, Minus, Loader2 } from 'lucide-react'
import { useGroqChat } from '../../hooks/useGroqChat'

interface Props {
  symbol: string
}

const SUGGESTIONS = [
  { icon: <TrendingUp size={12} />,   label: 'Проанализируй тренд' },
  { icon: <Activity size={12} />,     label: 'Найди уровни поддержки' },
  { icon: <ShieldAlert size={12} />,  label: 'Оцени риски входа' },
]

// Badge driven purely by the rule-based technical score:
//   > 0.3 → bull, < -0.3 → bear, in-between → neutral, null/undefined → loading.
// No percentages, no "боковик".
function PredictionBadge({ ruleScore }: { ruleScore: number | null | undefined }) {
  const loading = ruleScore === null || ruleScore === undefined
  const isBull = typeof ruleScore === 'number' && ruleScore > 0.3
  const isBear = typeof ruleScore === 'number' && ruleScore < -0.3

  const { color, Icon, label } = loading
    ? { color: '#6b7280', Icon: Loader2, label: 'Загрузка...' }
    : isBull
      ? { color: '#16a34a', Icon: TrendingUp, label: 'Бычий сигнал' }
      : isBear
        ? { color: '#dc2626', Icon: TrendingDown, label: 'Медвежий сигнал' }
        : { color: '#6b7280', Icon: Minus, label: 'Нейтральный' }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: `${color}15`, color, fontSize: 10, fontWeight: 600,
    }}>
      {loading ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'inline-flex' }}
        >
          <Loader2 size={12} />
        </motion.span>
      ) : (
        <Icon size={12} />
      )}
      {label}
    </div>
  )
}

export default function AIPanel({ symbol }: Props) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null!)

  const { messages, loading, error, prediction, send } = useGroqChat({ symbol })

  console.debug('[AIPanel] rendered for %s', symbol)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return
    send(input.trim())
    setInput('')
  }, [input, loading, send])

  const handlePromptClick = useCallback((text: string) => {
    send(text)
  }, [send])

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--accent-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={18} color="var(--accent)" strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ИИ-ассистент</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
            Анализ: {symbol}
          </div>
        </div>
        <PredictionBadge ruleScore={prediction?.rule_score} />
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
        marginBottom: 8, scrollbarWidth: 'thin', minHeight: 0,
      }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {SUGGESTIONS.map((s) => (
              <motion.button
                key={s.label}
                // Contained hover (no scale) so the block never spills past the
                // panel frame on hover (bug #10).
                whileHover={{ borderColor: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePromptClick(s.label)}
                style={{
                  padding: '8px 10px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--white)',
                  color: 'var(--ink)', cursor: 'pointer', fontSize: 11,
                  fontWeight: 500, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--font)',
                }}
              >
                {s.icon}
                {s.label}
              </motion.button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 6, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '90%', padding: '6px 10px',
                  borderRadius: msg.role === 'user' ? '10px 10px 4px 10px' : '10px 10px 10px 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)' }} />
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)', opacity: 0.6 }} />
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)', opacity: 0.3 }} />
                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>Анализирую...</span>
              </div>
            )}
            {error && (
              <div style={{
                padding: '6px 10px', borderRadius: 8,
                background: '#FEF2F2', color: '#991B1B', fontSize: 10,
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
        display: 'flex', gap: 6, alignItems: 'flex-end',
        background: 'var(--bg)', borderRadius: 10,
        padding: '4px 4px 4px 10px', border: '1px solid var(--border)',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Задайте вопрос об активе..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font)',
            padding: '4px 0',
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: 28, height: 28, borderRadius: 7,
            background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
            color: '#fff', border: 'none',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          <Send size={11} />
        </motion.button>
      </div>
    </div>
  )
}
