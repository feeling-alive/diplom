import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatLinkCard {
  type: 'news' | 'asset'
  title: string
  subtitle?: string | null
  href: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  // Navigation cards returned by chat tools (bug #11.3). Only present on fresh
  // assistant replies — not persisted in the saved history.
  cards?: ChatLinkCard[]
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
  link_cards?: ChatLinkCard[]
}

export function useGroqChat({ symbol }: UseGroqChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionInfo | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  // Rehydrate the saved dialog on mount / symbol change so it survives reloads and
  // navigation (bug #11.1). The backend persists every exchange per (user, symbol);
  // without this the UI started blank even though the model "remembered" context.
  const currentSymbol = symbol || 'general'
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch(
          `/api/chat/history?symbol=${encodeURIComponent(currentSymbol)}`,
          { credentials: 'include' },
        )
        if (!res.ok) {
          // 401 (not logged in) or transient — leave the dialog empty, don't error.
          console.debug('[useGroqChat] history load skipped status=%d symbol=%s', res.status, currentSymbol)
          return
        }
        const json = (await res.json()) as { messages: ChatMessage[] }
        if (!active) return
        const loaded = json.messages ?? []
        messagesRef.current = loaded
        setMessages(loaded)
        console.debug('[useGroqChat] history loaded symbol=%s count=%d', currentSymbol, loaded.length)
      } catch (err) {
        console.warn('[useGroqChat] history load failed', err)
      }
    })()
    return () => { active = false }
  }, [currentSymbol])

  const send = useCallback(async (userMessage: string) => {
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

      console.debug('[useGroqChat] reply received len=%d cards=%d', reply.length, json.link_cards?.length ?? 0)

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, cards: json.link_cards ?? [] }
      const updated = [...history, assistantMsg]
      messagesRef.current = updated
      setMessages(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[useGroqChat] error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [currentSymbol])

  // round 3 (C2): append a user question + a canned assistant reply locally,
  // WITHOUT hitting the backend/model. Used by the «Что ты умеешь» quick block —
  // a fixed capabilities answer that never varies and costs no AI request.
  const sendLocalAnswer = useCallback((userMessage: string, assistantReply: string) => {
    console.debug('[useGroqChat] local answer (no model) for %s', userMessage.slice(0, 40))
    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    const assistantMsg: ChatMessage = { role: 'assistant', content: assistantReply }
    const updated = [...messagesRef.current, userMsg, assistantMsg]
    messagesRef.current = updated
    setMessages(updated)
    setError(null)
  }, [])

  // Clear must also wipe the server-side session (bug #11.1) — otherwise the
  // accumulated context lived on in the DB and "Очистить" only reset the UI.
  const clear = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setError(null)
    setPrediction(null)
    void (async () => {
      try {
        await fetch(`/api/chat/history?symbol=${encodeURIComponent(currentSymbol)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        console.debug('[useGroqChat] cleared server history symbol=%s', currentSymbol)
      } catch (err) {
        console.warn('[useGroqChat] clear server history failed', err)
      }
    })()
  }, [currentSymbol])

  return { messages, loading, error, prediction, send, sendLocalAnswer, clear }
}
