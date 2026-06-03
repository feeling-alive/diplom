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

const ENVELOPE_KEY = 'fintrack_dashboards_v1'

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
    // Первый вход гостя засевает дефолтный envelope в localStorage.
    expect(result.current.widgets.length).toBe(4)
    expect(result.current.dashboards.length).toBe(1)
    expect(getDashboardConfig).not.toHaveBeenCalled()
    expect(localStorage.getItem(ENVELOPE_KEY)).not.toBeNull()
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

describe('useDashboardConfig — несколько дашбордов (Задача 7b)', () => {
  beforeEach(() => {
    localStorage.clear()
    authState = { isAuthenticated: false, isLoading: false }
  })

  it('add → switch → remove + лимит 5', async () => {
    const { result } = renderHook(() => useDashboardConfig())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.dashboards.length).toBe(1)

    // Добавление переключает на новый дашборд (пустой).
    act(() => result.current.addDashboard('Крипта'))
    expect(result.current.dashboards.length).toBe(2)
    expect(result.current.dashboards[1].name).toBe('Крипта')
    expect(result.current.activeId).toBe(result.current.dashboards[1].id)
    expect(result.current.widgets.length).toBe(0)

    // Переключение обратно на первый возвращает его виджеты (4 дефолтных).
    const firstId = result.current.dashboards[0].id
    act(() => result.current.switchDashboard(firstId))
    expect(result.current.activeId).toBe(firstId)
    expect(result.current.widgets.length).toBe(4)

    // Лимит 5: добавляем до предела, затем canAdd=false и +1 игнорируется.
    act(() => { result.current.addDashboard('a'); result.current.addDashboard('b'); result.current.addDashboard('c') })
    expect(result.current.dashboards.length).toBe(5)
    expect(result.current.canAddDashboard).toBe(false)
    act(() => result.current.addDashboard('лишний'))
    expect(result.current.dashboards.length).toBe(5)

    // Удаление активного переносит активность на первый из оставшихся.
    const removeId = result.current.activeId
    act(() => result.current.removeDashboard(removeId))
    expect(result.current.dashboards.length).toBe(4)
    expect(result.current.dashboards.some((d) => d.id === removeId)).toBe(false)
  })

  it('последний дашборд удалить нельзя', async () => {
    const { result } = renderHook(() => useDashboardConfig())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const onlyId = result.current.dashboards[0].id
    act(() => result.current.removeDashboard(onlyId))
    expect(result.current.dashboards.length).toBe(1)
  })
})
