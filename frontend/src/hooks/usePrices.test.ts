import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePrices } from './usePrices'

// Общий QueryClient на «сессию» — имитирует кэш приложения, переживающий размонтирование.
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnMount: false, retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

describe('usePrices (Задача 2 + 3)', () => {
  beforeEach(() => {
    // Все внешние запросы падают → updates пуст → к снимку применяется jitter.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('снимок не содержит индексов, все цены конечны', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePrices(), { wrapper })

    await waitFor(() => expect(result.current.lastUpdated).toBeGreaterThan(0))

    expect(result.current.bySymbol['SPX']).toBeUndefined()
    expect(result.current.all.length).toBeGreaterThan(0)
    expect(result.current.all.every((a) => Number.isFinite(a.price))).toBe(true)
  })

  it('Задача 2: повторный маунт с тем же QueryClient не показывает isLoading заново', async () => {
    const { qc, wrapper } = makeWrapper()

    const first = renderHook(() => usePrices(), { wrapper })
    await waitFor(() => expect(first.result.current.lastUpdated).toBeGreaterThan(0))
    first.unmount()

    // Повторный маунт читает кэш QueryClient: данные уже есть → isLoading=false сразу.
    const second = renderHook(() => usePrices(), { wrapper })
    expect(second.result.current.isLoading).toBe(false)
    expect(second.result.current.lastUpdated).toBeGreaterThan(0)
    expect(qc.getQueryData(['prices', 'all'])).toBeDefined()
  })
})
