import { useState, useCallback, useRef } from 'react'
import { ENV } from '../lib/env'

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
  const messagesRef = useRef<ChatMessage[]>([])

  const send = useCallback(async (userMessage: string) => {
    console.debug('[useGroqChat] send msg=%s', userMessage.slice(0, 60))

    const userMsg: ChatMessage = { role: 'user', content: userMessage }
    const history = [...messagesRef.current, userMsg]
    messagesRef.current = history
    setMessages(history)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${ENV.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: ENV.GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
          ],
          temperature: 0.7,
          max_tokens: 512,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Groq ${response.status}: ${errText.slice(0, 200)}`)
      }

      const json = await response.json() as {
        choices: Array<{ message: { content: string } }>
      }
      const reply = json.choices[0]?.message.content ?? '(нет ответа)'
      console.debug('[useGroqChat] reply=%s', reply.slice(0, 80))

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
  }, [systemPrompt])

  const clear = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, send, clear }
}
