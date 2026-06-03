// Settings page (Задача 10) at /settings. Sections: Appearance (light/dark theme +
// accent from the design-system palette), Notifications (UI-only toggles), Default
// currency (delegates to CurrencyContext), Language (Russian; others are a stub).
// All state lives in SettingsContext and persists to localStorage.

import type { ReactNode } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import { useSettings, ACCENT_OPTIONS, type Theme } from '../context/SettingsContext'
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from '../utils/format'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{description}</div>}
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer' }}>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 999, position: 'relative', flexShrink: 0,
          background: checked ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18,
          borderRadius: 999, background: 'var(--white)', transition: 'left 0.2s', boxShadow: 'var(--shadow-sm)',
        }} />
      </button>
    </label>
  )
}

export default function SettingsPage() {
  const {
    theme, accentId, notifications, defaultCurrency,
    setTheme, setAccent, setNotification, setDefaultCurrency,
  } = useSettings()

  const themeBtn = (value: Theme, icon: ReactNode, label: string) => {
    const active = theme === value
    return (
      <button
        aria-label={label}
        aria-pressed={active}
        onClick={() => setTheme(value)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 'var(--r-md)',
          border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
          background: active ? 'var(--accent-bg)' : 'var(--white)',
          color: active ? 'var(--accent)' : 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <div className="main-content" style={{ flex: 1 }}>
      <div style={{ padding: '18px 20px 8px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Настройки</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Внешний вид, уведомления и валюта по умолчанию</div>
      </div>

      <div className="main-scroll">
        <div style={{ maxWidth: 640, padding: '8px 20px 32px' }}>
          <Section title="Внешний вид" description="Тема оформления и акцентный цвет">
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>Тема</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {themeBtn('light', <Sun size={15} />, 'Светлая')}
              {themeBtn('dark', <Moon size={15} />, 'Тёмная')}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>Акцент</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {ACCENT_OPTIONS.map((a) => {
                const active = a.id === accentId
                return (
                  <button
                    key={a.id}
                    aria-label={a.label}
                    aria-pressed={active}
                    onClick={() => setAccent(a.id)}
                    title={a.label}
                    style={{
                      width: 36, height: 36, borderRadius: 999, background: a.accent, cursor: 'pointer',
                      border: '2px solid ' + (active ? 'var(--ink)' : 'transparent'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {active && <Check size={16} color="#fff" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Уведомления" description="Демо-режим: переключатели влияют только на интерфейс">
            <Toggle label="Ценовые алерты" checked={notifications.priceAlerts} onChange={(v) => setNotification('priceAlerts', v)} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Toggle label="Новости рынка" checked={notifications.news} onChange={(v) => setNotification('news', v)} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Toggle label="Email-рассылка" checked={notifications.email} onChange={(v) => setNotification('email', v)} />
          </Section>

          <Section title="Валюта по умолчанию" description="Применяется ко всему приложению (тот же стор, что и переключатель в шапке)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CURRENCIES.map((c: Currency) => {
                const active = c === defaultCurrency
                return (
                  <button
                    key={c}
                    aria-label={c}
                    aria-pressed={active}
                    onClick={() => setDefaultCurrency(c)}
                    style={{
                      padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                      background: active ? 'var(--accent-bg)' : 'var(--white)',
                      color: active ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    {CURRENCY_SYMBOL[c]} {c}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Язык" description="Интерфейс приложения">
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                aria-pressed
                style={{
                  padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'default',
                }}
              >
                Русский
              </button>
              <button
                disabled
                title="Скоро"
                style={{
                  padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--muted)',
                  opacity: 0.5, cursor: 'not-allowed',
                }}
              >
                English
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
