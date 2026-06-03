// User settings (Задача 10): appearance (theme + accent), notification toggles
// (UI-only in the demo), default currency (delegated to CurrencyContext) and
// language. Persisted to localStorage (a DB-backed sync is a follow-up). Modeled
// on AuthContext/CurrencyContext — the cross-cutting globals ARCHITECTURE allows.
//
// Theme is applied best-effort via a `data-theme` attribute on <html> plus the
// dark overrides in index.css; accent is applied by overriding the existing
// --accent CSS variables (no NEW palette colors — RULES.md keeps the palette
// closed, so accent choices are existing design-system values only).

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useCurrency } from './CurrencyContext'
import type { Currency } from '../utils/format'

export type Theme = 'light' | 'dark'

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
  theme: Theme
  accentId: string
  notifications: NotificationSettings
  language: 'ru'
}

interface SettingsContextValue extends SettingsState {
  defaultCurrency: Currency
  setTheme: (t: Theme) => void
  setAccent: (id: string) => void
  setNotification: (key: keyof NotificationSettings, value: boolean) => void
  setDefaultCurrency: (c: Currency) => void
}

const LS_SETTINGS = 'fintrack_settings_v1'

const DEFAULTS: SettingsState = {
  theme: 'light',
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
  return DEFAULTS
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currency, setCurrency } = useCurrency()
  const [state, setState] = useState<SettingsState>(loadSettings)

  const persist = (next: SettingsState) => {
    setState(next)
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)) } catch { /* ignore */ }
  }

  // Apply theme + accent to the document whenever they change.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', state.theme)
    const accent = ACCENT_OPTIONS.find((a) => a.id === state.accentId) ?? ACCENT_OPTIONS[0]
    root.style.setProperty('--accent', accent.accent)
    root.style.setProperty('--accent-bg', accent.accentBg)
    root.style.setProperty('--red', accent.accent)
    console.debug('[SettingsContext] applied theme=%s accent=%s', state.theme, accent.id)
  }, [state.theme, state.accentId])

  const value: SettingsContextValue = {
    ...state,
    defaultCurrency: currency,
    setTheme: (theme) => persist({ ...state, theme }),
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
