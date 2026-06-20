import { useState, useCallback, useRef } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PredictionInfo {
  direction: string
  probability: number
  source: string
  low_confidence?: boolean
  rule_score?: number | null
  indicator_details?: Record<string, unknown> | null
}

interface UseGroqChatOptions {
  symbol?: string
}

interface ChatApiResponse {
  reply: string
  prediction?: PredictionInfo
}

export function useGroqChat({ symbol }: UseGroqChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionInfo | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  const send = useCallback(async (userMessage: string) => {
    const currentSymbol = symbol || 'general'
    console.debug('[useGroqChat] POST /api/chat/message symbol=%s msg=%s', currentSymbol, userMessage.slice(0, 60))

    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    const history = [...messagesRef.current, userMsg]
    messagesRef.current = history
    setMessages(history)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          symbol: currentSymbol,
        }),
      })

      if (response.status === 429) {
        // Silent AI rate limit (server-side). Show a clean message without
        // exposing the limit value.
        console.warn('[useGroqChat] rate limited (429)')
        throw new Error('Слишком много запросов к ИИ, попробуйте через минуту')
      }

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend ${response.status}: ${errText.slice(0, 200)}`)
      }

      const json: ChatApiResponse = await response.json()
      const reply = json.reply || '(нет ответа)'

      if (json.prediction) {
        setPrediction(json.prediction)
      }

      console.debug('[useGroqChat] reply received len=%d', reply.length)

      const updated = [...history, { role: 'assistant' as const, content: reply }]
      messagesRef.current = updated
      setMessages(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[useGroqChat] error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  const clear = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setError(null)
    setPrediction(null)
  }, [])

  return { messages, loading, error, prediction, send, clear }
}
