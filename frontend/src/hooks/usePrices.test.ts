import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePrices } from './usePrices'

// Задача 3: индексы (SPX/DJI/IXIC/...) не имеют бесплатного живого источника, поэтому
// usePrices НЕ должен применять к ним случайный jitter — иначе SPX «дрожит» вокруг снимка.
describe('usePrices — стабильность индексов (Задача 3)', () => {
  beforeEach(() => {
    // Все внешние запросы (OKX / /api/quotes/*) падают → updates пуст → к не-индексам
    // применяется jitter, индексы остаются неизменными (по фиксу).
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('не применяет jitter к индексам между тиками', async () => {
    const { result } = renderHook(() => usePrices())

    const spxBefore = result.current.bySymbol['SPX']?.price
    expect(spxBefore).toBeGreaterThan(0)

    // Дождаться завершения первого тика (lastUpdated > 0 после setPrices).
    await waitFor(() => expect(result.current.lastUpdated).toBeGreaterThan(0))

    // Цена индекса не изменилась, несмотря на тик с jitter для остальных активов.
    expect(result.current.bySymbol['SPX']?.price).toBe(spxBefore)
    expect(result.current.bySymbol['DJI']?.price).toBe(
      result.current.indices.find((i) => i.symbol === 'DJI')?.price,
    )
    // Все индексы остаются конечными числами (снимок не повреждён).
    expect(result.current.indices.length).toBeGreaterThan(0)
    expect(result.current.indices.every((i) => Number.isFinite(i.price))).toBe(true)
  })
})
