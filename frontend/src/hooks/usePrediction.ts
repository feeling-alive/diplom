import { useEffect, useState } from 'react'

/** PatchTST directional prediction for an asset, from our backend. */
export interface PredictionData {
  direction: string
  probability: number
  source: string
  low_confidence: boolean
}

export interface UsePredictionResult {
  data: PredictionData | null
  isLoading: boolean
  error: Error | null
}

const MOCK_PREDICTION: PredictionData = {
  direction: 'SIDEWAYS',
  probability: 0.5,
  source: 'mock',
  low_confidence: true,
}

/**
 * Fetch a PatchTST prediction for `symbol` from `GET /api/chat/predict/{symbol}`.
 *
 * Follows the project data-hook contract: optional `useMock` (default true) for
 * key-less / offline development, and a `{ data, isLoading, error }` shape. With
 * `useMock=true` it returns a neutral mock without hitting the backend; pass
 * `useMock={false}` for live predictions (still falls back to mock on error).
 */
export function usePrediction(symbol: string, useMock: boolean = true): UsePredictionResult {
  const [state, setState] = useState<UsePredictionResult>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    if (useMock) {
      console.debug('[usePrediction] mock %s', symbol)
      setState({ data: { ...MOCK_PREDICTION }, isLoading: false, error: null })
      return
    }

    if (!symbol) {
      setState({ data: null, isLoading: false, error: null })
      return
    }

    setState((s) => ({ ...s, isLoading: true }))

    const run = async () => {
      try {
        const res = await fetch(`/api/chat/predict/${encodeURIComponent(symbol)}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`GET /api/chat/predict ${res.status}`)
        const json = await res.json()
        const data: PredictionData = {
          direction: typeof json.direction === 'string' ? json.direction : 'SIDEWAYS',
          probability: typeof json.probability === 'number' ? json.probability : 0.5,
          source: typeof json.source === 'string' ? json.source : 'fallback',
          low_confidence: Boolean(json.low_confidence),
        }
        console.debug('[usePrediction] live %s -> %o', symbol, data)
        if (!cancelled) setState({ data, isLoading: false, error: null })
      } catch (err) {
        console.warn('[usePrediction] API failed, using mock', err)
        if (!cancelled) {
          setState({ data: { ...MOCK_PREDICTION }, isLoading: false, error: err as Error })
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [symbol, useMock])

  return state
}
