import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGroqChat } from '../../hooks/useGroqChat'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

const HINT_QUESTIONS = [
  'Каков прогноз?',
  'Что влияет на цену?',
  'Объясни последние движения',
]

export default function ChatPanel({ asset }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const systemPrompt = `Ты финансовый аналитик. Помогаешь анализировать актив ${asset.symbol} (${asset.name}).
Отвечай кратко и по делу на русском языке. Используй конкретные данные когда возможно.
Текущая цена: ~${asset.type === 'forex' ? asset.price.toFixed(5) : `$${asset.price.toFixed(2)}`}.
Изменение за 24ч: ${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%.`

  const { messages, loading, error, send, clear } = useGroqChat({ systemPrompt })

  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const noKey = !apiKey

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleSend() {
    const text = input.trim()
    if (!text || loading || noKey) return
    console.debug('[ChatPanel] sending:', text.slice(0, 60))
    setInput('')
    void send(text)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} strokeWidth={2} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ИИ-аналитик</span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              background: 'var(--bg)',
              borderRadius: 4,
              padding: '2px 6px',
              border: '1px solid var(--border)',
            }}
          >
            LLaMA 3
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            title="Очистить чат"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        } as React.CSSProperties}
      >
        {/* No API key warning */}
        {noKey && (
          <div
            style={{
              background: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#92400E',
              lineHeight: 1.5,
            }}
          >
            Добавьте <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3 }}>VITE_GROQ_API_KEY</code> в файл{' '}
            <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3 }}>.env.local</code> для работы ИИ-чата.
          </div>
        )}

        {/* Empty state with hint prompts */}
        {messages.length === 0 && !noKey && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 20,
              gap: 10,
            }}
          >
            <Bot size={28} strokeWidth={1.2} color="var(--muted)" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Задайте вопрос об активе {asset.symbol}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {HINT_QUESTIONS.map(hint => (
                <button
                  key={hint}
                  onClick={() => void send(hint)}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '7px 12px',
                    fontSize: 11,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: msg.role === 'user' ? 'var(--ink)' : 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {msg.role === 'user'
                  ? <User size={12} strokeWidth={2} color="#fff" />
                  : <Bot size={12} strokeWidth={2} color="#fff" />}
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 12,
                  lineHeight: 1.65,
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={12} strokeWidth={2} color="#fff" />
            </div>
            <div
              style={{
                display: 'flex', gap: 4, alignItems: 'center',
                padding: '8px 14px',
                background: 'var(--bg)',
                borderRadius: '4px 12px 12px 12px',
                border: '1px solid var(--border)',
              }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--accent)',
              background: 'var(--accent-bg)',
              borderRadius: 6,
              padding: '6px 10px',
            }}
          >
            Ошибка: {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={noKey ? 'Настройте API ключ...' : 'Задать вопрос...'}
          disabled={noKey || loading}
          style={{
            flex: 1,
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--ink)',
            background: noKey ? 'var(--bg)' : 'var(--white)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || noKey}
          style={{
            background: input.trim() && !loading && !noKey ? 'var(--ink)' : 'var(--border)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: input.trim() && !loading && !noKey ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          <Send
            size={14}
            strokeWidth={2}
            color={input.trim() && !loading && !noKey ? '#fff' : 'var(--muted)'}
          />
        </button>
      </div>
    </div>
  )
}
