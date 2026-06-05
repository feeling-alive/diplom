import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { usePrediction } from '../usePrediction'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('usePrediction', () => {
  it('returns a neutral mock without fetching when useMock=true', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePrediction('BTC-USDT', true))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.source).toBe('mock')
    expect(result.current.data?.low_confidence).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches a live prediction when useMock=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        direction: 'UP',
        probability: 0.7,
        source: 'huggingface',
        low_confidence: false,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePrediction('BTC-USDT', false))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.direction).toBe('UP')
    expect(result.current.data?.probability).toBe(0.7)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/predict/BTC-USDT',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('falls back to mock on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { result } = renderHook(() => usePrediction('BTC-USDT', false))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.source).toBe('mock')
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
