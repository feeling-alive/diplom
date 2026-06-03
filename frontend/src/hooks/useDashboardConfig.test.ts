import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useDashboardConfig } from './useDashboardConfig'

// Controllable auth state per test.
let authState = { isAuthenticated: false, isLoading: false }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null, ...authState,
    setUser: vi.fn(), updateUser: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
  }),
}))

const getDashboardConfig = vi.fn()
const putDashboardConfig = vi.fn()
vi.mock('../lib/dashboardApi', () => ({
  getDashboardConfig: (...a: unknown[]) => getDashboardConfig(...a),
  putDashboardConfig: (...a: unknown[]) => putDashboardConfig(...a),
}))

const STORAGE_KEY = 'fintrack_widgets_v4'

describe('useDashboardConfig — выбор источника (Задача 1b)', () => {
  beforeEach(() => {
    localStorage.clear()
    getDashboardConfig.mockReset()
    putDashboardConfig.mockReset()
    authState = { isAuthenticated: false, isLoading: false }
  })

  it('гость → читает из localStorage, бэкенд не вызывается', async () => {
    const { result } = renderHook(() => useDashboardConfig())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Первый вход гостя засевает дефолты в localStorage.
    expect(result.current.widgets.length).toBe(4)
    expect(getDashboardConfig).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('авторизован → читает layout из бэкенда', async () => {
    authState = { isAuthenticated: true, isLoading: false }
    getDashboardConfig.mockResolvedValue([
      { id: 'w_1', type: 'watchlist', size: { w: 2, h: 2, label: '2×2' }, x: 0, y: 0, w: 2, h: 2 },
    ])
    const { result } = renderHook(() => useDashboardConfig())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getDashboardConfig).toHaveBeenCalledTimes(1)
    expect(result.current.widgets).toHaveLength(1)
    expect(result.current.widgets[0].type).toBe('watchlist')
  })

  it('авторизован, бэкенд упал → fallback на localStorage', async () => {
    authState = { isAuthenticated: true, isLoading: false }
    getDashboardConfig.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useDashboardConfig())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Fallback засевает дефолты из localStorage, не падает.
    expect(result.current.widgets.length).toBe(4)
  })

  it('авторизован → mutate дебаунсит PUT в бэкенд', async () => {
    vi.useFakeTimers()
    authState = { isAuthenticated: true, isLoading: false }
    getDashboardConfig.mockResolvedValue([])
    putDashboardConfig.mockResolvedValue([])
    const { result } = renderHook(() => useDashboardConfig())
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.mutate(() => [
        { id: 'w_x', type: 'watchlist', size: { w: 2, h: 2, label: '2×2' }, x: 0, y: 0, w: 2, h: 2 },
      ])
    })
    // Дебаунс ещё не истёк.
    expect(putDashboardConfig).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(700) })
    expect(putDashboardConfig).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
