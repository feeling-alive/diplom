// Liquid-Glass currency switcher (Задача 6): an oval segmented control with a
// sliding frosted pill (framer-motion layoutId) marking the active currency.
// Colors come only from existing design-system variables via rgba() — no new
// palette entries (RULES.md: design system is closed).

import { motion } from 'framer-motion'
import { useCurrency } from '../../context/CurrencyContext'
import { CURRENCIES, CURRENCY_SYMBOL } from '../../utils/format'

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div
      role="radiogroup"
      aria-label="Валюта отображения"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        // Liquid glass: translucent surface + blur + subtle inner border.
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {CURRENCIES.map((c) => {
        const active = c === currency
        return (
          <button
            key={c}
            role="radio"
            aria-checked={active}
            aria-label={c}
            onClick={() => setCurrency(c)}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '5px 11px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontFamily: 'var(--font)',
              transition: 'color 0.2s',
            }}
          >
            {active && (
              <motion.span
                layoutId="currency-glass-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>
              {CURRENCY_SYMBOL[c]} {c}
            </span>
          </button>
        )
      })}
    </div>
  )
}
