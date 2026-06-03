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
    // Все внешние запросы падают → updates пуст → к не-индексам применяется jitter,
    // индексы остаются неизменными (фикс Задачи 3).
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('Задача 3: не применяет jitter к индексам', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePrices(), { wrapper })

    const spxBefore = result.current.bySymbol['SPX']?.price
    expect(spxBefore).toBeGreaterThan(0)

    await waitFor(() => expect(result.current.lastUpdated).toBeGreaterThan(0))

    expect(result.current.bySymbol['SPX']?.price).toBe(spxBefore)
    expect(result.current.indices.length).toBeGreaterThan(0)
    expect(result.current.indices.every((i) => Number.isFinite(i.price))).toBe(true)
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
