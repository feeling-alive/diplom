// Settings page (Задача 10) at /settings. Sections: Default currency (delegates to
// CurrencyContext). Тёмная тема убрана в round 3 — приложение всегда светлое, секция
// «Внешний вид» с переключателем темы удалена. All state lives in SettingsContext
// and persists to localStorage.

import type { ReactNode } from 'react'
import { useSettings } from '../context/SettingsContext'
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

export default function SettingsPage() {
  const { defaultCurrency, setDefaultCurrency } = useSettings()

  return (
    <div className="main-content" style={{ flex: 1 }}>
      <div style={{ padding: '18px 20px 8px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Настройки</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Валюта по умолчанию</div>
      </div>

      <div className="main-scroll">
        <div style={{ maxWidth: 640, padding: '8px 20px 32px' }}>
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


        </div>
      </div>
    </div>
  )
}
