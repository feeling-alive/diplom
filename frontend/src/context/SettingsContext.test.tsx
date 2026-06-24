import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SettingsProvider, useSettings } from './SettingsContext'

// Controllable currency context (SettingsContext delegates default currency to it).
const setCurrencyMock = vi.fn()
let currencyValue = 'USD'
vi.mock('./CurrencyContext', () => ({
  useCurrency: () => ({
    currency: currencyValue,
    setCurrency: setCurrencyMock,
    convert: (n: number) => n,
    rates: { USD: 1, EUR: 0.9, RUB: 90, BTC: 1 / 50000 },
  }),
}))

const LS = 'fintrack_settings_v1'

function wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

describe('SettingsContext (Задача 10)', () => {
  beforeEach(() => {
    localStorage.clear()
    setCurrencyMock.mockClear()
    currencyValue = 'USD'
    document.documentElement.removeAttribute('data-theme')
  })

  it('приложение всегда светлое — data-theme на <html> не выставляется', () => {
    renderHook(() => useSettings(), { wrapper })
    // Тёмная тема убрана (round 3): атрибут снимается, остаётся светлая тема.
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('акцент переопределяет CSS-переменную --accent', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.setAccent('green'))
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#22C55E')
    expect(JSON.parse(localStorage.getItem(LS)!).accentId).toBe('green')
  })

  it('переключатель уведомления сохраняется', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.notifications.email).toBe(false)
    act(() => result.current.setNotification('email', true))
    expect(result.current.notifications.email).toBe(true)
    expect(JSON.parse(localStorage.getItem(LS)!).notifications.email).toBe(true)
  })

  it('валюта по умолчанию делегируется в CurrencyContext', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.setDefaultCurrency('RUB'))
    expect(setCurrencyMock).toHaveBeenCalledWith('RUB')
  })
})
