// User settings (Задача 10): appearance (accent only — тёмная тема убрана в round 3),
// notification toggles (UI-only in the demo), default currency (delegated to
// CurrencyContext) and language. Persisted to localStorage (a DB-backed sync is a
// follow-up). Modeled on AuthContext/CurrencyContext — the cross-cutting globals
// ARCHITECTURE allows.
//
// Приложение всегда светлое: переключатель темы и тёмная ветка удалены (round 3, A1).
// Accent применяется переопределением существующих --accent CSS-переменных (никаких
// НОВЫХ цветов палитры — RULES.md держит палитру закрытой).

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useCurrency } from './CurrencyContext'
import type { Currency } from '../utils/format'

export interface AccentOption {
  id: string
  label: string
  accent: string
  accentBg: string
}

// Accents drawn only from existing design-system values (rose is the default
// --accent, green is --green). No new colors introduced.
export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'rose', label: 'Малиновый', accent: '#E11D48', accentBg: '#FFE5EC' },
  { id: 'green', label: 'Зелёный', accent: '#22C55E', accentBg: '#E8F8EF' },
  { id: 'slate', label: 'Графит', accent: '#0F172A', accentBg: '#E7EAF0' },
]

export interface NotificationSettings {
  priceAlerts: boolean
  news: boolean
  email: boolean
}

interface SettingsState {
  accentId: string
  notifications: NotificationSettings
  language: 'ru'
}

interface SettingsContextValue extends SettingsState {
  defaultCurrency: Currency
  setAccent: (id: string) => void
  setNotification: (key: keyof NotificationSettings, value: boolean) => void
  setDefaultCurrency: (c: Currency) => void
}

const LS_SETTINGS = 'fintrack_settings_v1'

const DEFAULTS: SettingsState = {
  accentId: 'rose',
  notifications: { priceAlerts: true, news: true, email: false },
  language: 'ru',
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsState>
      return {
        ...DEFAULTS,
        ...parsed,
        notifications: { ...DEFAULTS.notifications, ...parsed.notifications },
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currency, setCurrency } = useCurrency()
  const [state, setState] = useState<SettingsState>(loadSettings)

  const persist = (next: SettingsState) => {
    setState(next)
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)) } catch { /* ignore */ }
  }

  // Приложение всегда светлое: снимаем любой ранее выставленный data-theme и
  // применяем только accent.
  useEffect(() => {
    const root = document.documentElement
    root.removeAttribute('data-theme')
    const accent = ACCENT_OPTIONS.find((a) => a.id === state.accentId) ?? ACCENT_OPTIONS[0]
    root.style.setProperty('--accent', accent.accent)
    root.style.setProperty('--accent-bg', accent.accentBg)
    root.style.setProperty('--red', accent.accent)
    console.debug('[SettingsContext] theme forced light, applied accent=%s', accent.id)
  }, [state.accentId])

  const value: SettingsContextValue = {
    ...state,
    defaultCurrency: currency,
    setAccent: (accentId) => persist({ ...state, accentId }),
    setNotification: (key, val) =>
      persist({ ...state, notifications: { ...state.notifications, [key]: val } }),
    setDefaultCurrency: (c) => setCurrency(c),
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (ctx === null) {
    throw new Error('useSettings must be used within <SettingsProvider>')
  }
  return ctx
}
