# FinTrack Step 5 — Asset Page + AI Chat

**Feature:** Asset detail page with TradingView candlestick chart and Groq/LLaMA-3 AI chat  
**Priority:** 4 — diploma supervisor demo (Asset Page is the centrepiece of the demo)  
**Mode:** Full  
**Tests:** No  
**Logging:** Verbose (DEBUG)  
**Docs:** Warn-only  

---

## Context

- **Framework:** React 18 + TypeScript strict + Vite
- **Routing:** react-router-dom v7 (`BrowserRouter` already wraps the app)
- **Charts:** `lightweight-charts` — **NOT YET INSTALLED** (Task 1)
- **AI:** Groq API `https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`, env var `VITE_GROQ_API_KEY`
- **Data hooks:** `useOHLCV(symbol, timeframe, useMock=true)`, `useAssetPrice(symbol, type, useMock=true)` — already exist
- **Types:** `Asset`, `PricePoint`, `Timeframe` — already in `src/types/market.types.ts`
- **Mock data:** `MOCK_PRICES` in `src/mock/prices.mock.ts`, `getMockOHLCV` in `src/mock/ohlcv.mock.ts`
- **Design tokens:** `--accent #E8264A`, `--green #22C55E`, `--ink #0D0D0D`, `--bg #F4F3F1`, `--white #FFFFFF`, `--border #ECEAE3`
- **CSS:** `.card` (white, border, radius 12px, shadow-sm), `.badge` (pill)
- **Animations:** Framer Motion — `whileHover={{ backgroundColor }}` (NOT `background`), page entry `initial/animate/transition`

---

## Tasks

### Task 1 — Install lightweight-charts, add route, create .env.example
**Status:** [x] complete

**Steps:**
1. `npm install lightweight-charts`
2. In `src/App.tsx` add:
   ```tsx
   import AssetPage from './pages/AssetPage'
   // inside <Routes>:
   <Route path="/asset/:symbol" element={<AssetPage />} />
   ```
3. Create `.env.example` at project root:
   ```
   # Groq API key — get one free at https://console.groq.com
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

**Acceptance:** `npm install` exits 0, App.tsx has the new route, `.env.example` exists.

---

### Task 2 — Create AssetHeader.tsx
**Status:** [x] complete

**File:** `src/components/asset/AssetHeader.tsx`

```tsx
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAssetPrice } from '../../hooks/useAssetPrice'
import { MOCK_PRICES } from '../../mock/prices.mock'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

export default function AssetHeader({ asset }: Props) {
  const navigate = useNavigate()
  const { price, change24h } = useAssetPrice(asset.symbol, asset.type, true)
  const positive = change24h >= 0

  console.debug('[AssetHeader] symbol=', asset.symbol, 'price=', price, 'change24h=', change24h)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{ padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/market')}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <ChevronLeft size={14} strokeWidth={2} />
        Назад
      </button>

      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: asset.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {asset.icon}
      </div>

      {/* Name + symbol */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
          {asset.symbol}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.name}</div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>
          {asset.type === 'forex'
            ? price.toFixed(5)
            : price >= 1000
            ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : price >= 1
            ? `$${price.toFixed(2)}`
            : `$${price.toFixed(4)}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
          {positive
            ? <TrendingUp size={12} strokeWidth={2} color="var(--green)" />
            : <TrendingDown size={12} strokeWidth={2} color="var(--accent)" />}
          <span
            className="badge"
            style={{
              background: positive ? '#E8F8EF' : 'var(--accent-bg)',
              color: positive ? 'var(--green)' : 'var(--accent)',
            }}
          >
            {positive ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      {asset.volume24h && (
        <div style={{ textAlign: 'right', paddingLeft: 24, borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Объём 24ч</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {asset.volume24h >= 1e9
              ? `$${(asset.volume24h / 1e9).toFixed(1)}B`
              : `$${(asset.volume24h / 1e6).toFixed(0)}M`}
          </div>
        </div>
      )}
      {asset.marketCap && (
        <div style={{ textAlign: 'right', paddingLeft: 24, borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Капитализация</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {asset.marketCap >= 1e12
              ? `$${(asset.marketCap / 1e12).toFixed(2)}T`
              : `$${(asset.marketCap / 1e9).toFixed(1)}B`}
          </div>
        </div>
      )}
    </motion.div>
  )
}
```

---

### Task 3 — Create CandlestickChart.tsx
**Status:** [x] complete

**File:** `src/components/asset/CandlestickChart.tsx`

Key implementation notes:
- Import: `import { createChart, type IChartApi, type ISeriesApi, CandlestickSeries } from 'lightweight-charts'`
- Timeframes: `['1H', '4H', '1D', '1W']` as `Timeframe[]`
- Default timeframe: `'1D'`
- `useRef<HTMLDivElement>(null)` for chart container
- `useRef<IChartApi | null>(null)` for chart instance
- `useRef<ISeriesApi<'Candlestick'> | null>(null)` for series
- `useOHLCV(symbol, timeframe, true)` for data — maps `PricePoint` to `{ time, open, high, low, close }`
- `ResizeObserver` on container for responsive width
- Chart options:
  ```ts
  {
    layout: { background: { color: 'transparent' }, textColor: '#666' },
    grid: { vertLines: { color: 'var(--border)' }, horzLines: { color: 'var(--border)' } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'var(--border)' },
    timeScale: { borderColor: 'var(--border)', timeVisible: true },
  }
  ```
- Candlestick colors: `{ upColor: '#22C55E', downColor: '#E8264A', borderUpColor: '#22C55E', borderDownColor: '#E8264A', wickUpColor: '#22C55E', wickDownColor: '#E8264A' }`
- Cleanup on unmount: `chart.remove()`

**Full component skeleton:**
```tsx
import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { useOHLCV } from '../../hooks/useOHLCV'
import type { Timeframe } from '../../types/market.types'

interface Props {
  symbol: string
}

const TIMEFRAMES: Timeframe[] = ['1H', '4H', '1D', '1W']

export default function CandlestickChart({ symbol }: Props) {
  const [tf, setTf] = useState<Timeframe>('1D')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const { data } = useOHLCV(symbol, tf, true)

  // create chart once
  useEffect(() => {
    if (!containerRef.current) return
    console.debug('[CandlestickChart] creating chart for', symbol)
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: { background: { color: 'transparent' }, textColor: '#666' },
      grid: {
        vertLines: { color: '#ECEAE3' },
        horzLines: { color: '#ECEAE3' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#ECEAE3' },
      timeScale: { borderColor: '#ECEAE3', timeVisible: true },
    })
    chartRef.current = chart
    const series = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#E8264A',
      borderUpColor: '#22C55E',
      borderDownColor: '#E8264A',
      wickUpColor: '#22C55E',
      wickDownColor: '#E8264A',
    })
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [symbol])

  // update data when tf or data changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return
    console.debug('[CandlestickChart] setting data, bars=', data.length, 'tf=', tf)
    const candles = data.map(p => ({
      time: Math.floor(p.time / 1000) as unknown as import('lightweight-charts').Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }))
    seriesRef.current.setData(candles)
    chartRef.current?.timeScale().fitContent()
  }, [data, tf])

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      {/* Timeframe tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TIMEFRAMES.map(t => (
          <button
            key={t}
            onClick={() => {
              console.debug('[CandlestickChart] timeframe changed to', t)
              setTf(t)
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: tf === t ? 'var(--ink)' : 'transparent',
              color: tf === t ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}
```

---

### Task 4 — Create useGroqChat.ts + ChatPanel.tsx
**Status:** [x] complete

**File 1:** `src/hooks/useGroqChat.ts`

```ts
import { useState, useCallback } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseGroqChatOptions {
  systemPrompt: string
}

export function useGroqChat({ systemPrompt }: UseGroqChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async (userMessage: string) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
    console.debug('[useGroqChat] send, msg=', userMessage.slice(0, 60))

    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setError(null)

    try {
      const body = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          userMsg,
        ],
        temperature: 0.7,
        max_tokens: 512,
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey ?? ''}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Groq API ${response.status}: ${errText}`)
      }

      const json = await response.json() as {
        choices: Array<{ message: { content: string } }>
      }
      const reply = json.choices[0]?.message.content ?? '(нет ответа)'
      console.debug('[useGroqChat] reply=', reply.slice(0, 80))
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[useGroqChat] error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [messages, systemPrompt])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, send, clear }
}
```

**File 2:** `src/components/asset/ChatPanel.tsx`

```tsx
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGroqChat } from '../../hooks/useGroqChat'
import type { Asset } from '../../types/market.types'

interface Props {
  asset: Asset
}

export default function ChatPanel({ asset }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const systemPrompt = `Ты финансовый аналитик FinTrack. Ты помогаешь анализировать актив ${asset.symbol} (${asset.name}).
Отвечай кратко и по делу на русском языке. Используй конкретные данные когда это возможно.
Текущая цена: ~$${asset.price.toFixed(asset.type === 'forex' ? 5 : 2)}.
Изменение за 24ч: ${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%.`

  const { messages, loading, error, send, clear } = useGroqChat({ systemPrompt })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    console.debug('[ChatPanel] sending:', text)
    setInput('')
    send(text)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const noKey = !apiKey

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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} strokeWidth={2} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ИИ-аналитик</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 4, padding: '2px 6px' }}>
            LLaMA 3
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
            title="Очистить чат"
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Messages */}
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
        }}
      >
        {noKey && (
          <div
            style={{
              background: '#FFF8E1',
              border: '1px solid #F9C74F',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#7B5800',
            }}
          >
            Добавьте <code>VITE_GROQ_API_KEY</code> в файл <code>.env.local</code> для работы чата.
          </div>
        )}

        {messages.length === 0 && !noKey && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 12,
              marginTop: 24,
            }}
          >
            <Bot size={28} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Задайте вопрос об активе {asset.symbol}</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                `Каков прогноз на ${asset.symbol}?`,
                'Что влияет на цену?',
                'Объясни последние движения',
              ].map(hint => (
                <button
                  key={hint}
                  onClick={() => send(hint)}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 11,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

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
              <div
                style={{
                  maxWidth: '78%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                }}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Bot size={12} strokeWidth={2} color="#fff" />
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', borderRadius: '4px 12px 12px 12px', border: '1px solid var(--border)' }}>
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

        {error && (
          <div style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 6, padding: '6px 10px' }}>
            Ошибка: {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
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
            background: 'var(--bg)',
            outline: 'none',
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
            transition: 'background 0.15s',
          }}
        >
          <Send size={14} strokeWidth={2} color={input.trim() && !loading && !noKey ? '#fff' : 'var(--muted)'} />
        </button>
      </div>
    </div>
  )
}
```

---

### Task 5 — Create AssetPage.tsx
**Status:** [x] complete

**File:** `src/pages/AssetPage.tsx`

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import FinTrackNavBar from '../components/layout/FinTrackNavBar'
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
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--white)', borderRadius: 22,
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>404</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>Актив «{symbol}» не найден</div>
          <button
            onClick={() => navigate('/market')}
            style={{
              marginTop: 8, padding: '8px 18px',
              background: 'var(--ink)', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, cursor: 'pointer',
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
          width: '100%', height: '100%',
          background: 'var(--white)', borderRadius: 22,
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '12px 22px 22px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          } as React.CSSProperties}
        >
          <FinTrackNavBar />
          <AssetHeader asset={asset} />

          {/* Chart + Chat */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 2fr',
              gap: 12,
              marginTop: 0,
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
```

---

### Task 6 — Add navigation to AssetStrip and AssetTable
**Status:** [x] complete

**AssetStrip.tsx** (`src/components/dashboard/AssetStrip.tsx`):
- Add `import { useNavigate } from 'react-router-dom'`
- Inside component: `const navigate = useNavigate()`
- On each pill card div: `onClick={() => navigate(\`/asset/${asset.symbol}\`)}` + `cursor: 'pointer'`

**AssetTable.tsx** (`src/components/market-overview/AssetTable.tsx`):
- Add `import { useNavigate } from 'react-router-dom'`
- Inside component: `const navigate = useNavigate()`
- On each `motion.div` row: add `onClick={() => { console.debug('[AssetTable] navigate to asset', asset.symbol); navigate(\`/asset/${asset.symbol}\`) }}`
- Row already has `cursor: pointer` — just add the onClick

---

### Task 7 — Verify: tsc --noEmit + test suite + smoke test
**Status:** [x] complete

**Steps:**
1. `npx tsc --noEmit` — must exit 0
2. `npm test -- --run` — all 26+ tests pass (regressions = 0)
3. `npm run dev` — open `/asset/BTC-USDT` manually:
   - AssetHeader shows BTC price
   - Candlestick chart renders bars
   - Chat panel shows hint buttons
   - Timeframe tabs switch correctly
4. Open `/asset/INVALID` — 404 state renders correctly

---

## Settings

```yaml
tests: false
logging: verbose
docs: warn
```

## File Map

| File | Action |
|------|--------|
| `package.json` / `node_modules` | install `lightweight-charts` |
| `.env.example` | create |
| `src/App.tsx` | add `/asset/:symbol` route |
| `src/components/asset/AssetHeader.tsx` | create |
| `src/components/asset/CandlestickChart.tsx` | create |
| `src/hooks/useGroqChat.ts` | create |
| `src/components/asset/ChatPanel.tsx` | create |
| `src/pages/AssetPage.tsx` | create |
| `src/components/dashboard/AssetStrip.tsx` | modify (add navigate) |
| `src/components/market-overview/AssetTable.tsx` | modify (add navigate) |
