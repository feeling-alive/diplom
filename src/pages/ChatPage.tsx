import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Lightbulb, Globe, Bot, User, TrendingUp, BookOpen, BarChart3, Shield } from 'lucide-react'
import { useGroqChat } from '../hooks/useGroqChat'

const SYSTEM_PROMPT = `Ты — финансовый AI-ассистент в приложении FinTrack. Отвечай кратко (3-5 предложений), на русском языке.
Помогай пользователю: объясняй термины (ETF, фьючерсы, опционы), анализируй рыночную ситуацию, советуй книги/ресурсы, оценивай риски стратегий.
Не давай конкретных инвестиционных рекомендаций — только образовательную информацию.`

const PLACEHOLDERS = [
  'Спроси про криптовалюты...',
  'Что такое ETF?',
  'Анализ рынка сегодня',
  'Как работают фьючерсы?',
  'Оцени риски стратегии',
  'Лучшие книги по трейдингу',
]

const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: 'Тренды рынка', text: 'Какие тренды на рынке сейчас?' },
  { icon: BookOpen, label: 'Обучение', text: 'С чего начать изучение инвестиций?' },
  { icon: BarChart3, label: 'Аналитика', text: 'Как анализировать акции?' },
  { icon: Shield, label: 'Риски', text: 'Как управлять рисками в портфеле?' },
]

export default function ChatPage() {
  const { messages, loading, error, send, clear } = useGroqChat({ systemPrompt: SYSTEM_PROMPT })
  const [input, setInput] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('')
  const [charIndex, setCharIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const textareaRef = useRef<HTMLTextAreaElement>(null!)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (charIndex < PLACEHOLDERS[placeholderIndex].length) {
      const timer = setTimeout(() => {
        setDisplayedPlaceholder((prev) => prev + PLACEHOLDERS[placeholderIndex][charIndex])
        setCharIndex((c) => c + 1)
      }, 50)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setDisplayedPlaceholder('')
        setCharIndex(0)
        setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [charIndex, placeholderIndex])

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return
    send(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, loading, send])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptClick = useCallback((text: string) => {
    send(text)
  }, [send])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--white)',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--accent-bg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={18} color="var(--accent)" />
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>AI Ассистент</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Финансовый советник</span>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={clear}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--white)', color: 'var(--muted)', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
          }}
        >
          Очистить
        </motion.button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', scrollbarWidth: 'thin' }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 24,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-bg)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={28} color="var(--accent)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                Чем могу помочь?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 360 }}>
                Задай вопрос о финансах, инвестициях или рынке
              </p>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 400,
            }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <motion.button
                  key={p.label}
                  whileHover={{ scale: 1.03, borderColor: 'var(--accent)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handlePromptClick(p.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--white)',
                    cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                  }}
                >
                  <p.icon size={16} color="var(--accent)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{p.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: msg.role === 'user' ? 'var(--accent-bg)' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {msg.role === 'user' ? <User size={14} color="var(--accent)" /> : <Bot size={14} color="var(--muted)" />}
                  </div>
                  <div style={{
                    maxWidth: '70%',
                    padding: '10px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="var(--muted)" />
                </div>
                <div style={{
                  padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg)', display: 'flex', gap: 4,
                }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--muted)',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {error && (
              <div style={{
                padding: '10px 16px', borderRadius: 12,
                background: '#FEF2F2', color: '#991B1B', fontSize: 12,
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
        padding: '16px 24px', borderTop: '1px solid var(--border)',
        background: 'var(--white)',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--bg)', borderRadius: 14,
          padding: '8px 8px 8px 16px',
          border: '1px solid var(--border)',
          transition: 'border-color 0.2s',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder={displayedPlaceholder}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)',
              resize: 'none', maxHeight: 120, lineHeight: 1.5,
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
              color: '#fff', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.2s',
            }}
          >
            <Send size={14} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
