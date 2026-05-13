import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const TARGET_VALUE = 528976.82
const PREV_VALUE = 501641.73
const CHANGE_PERCENT = 7.9
const CHANGE_DOLLAR = 27335.09
const ANIMATION_DURATION = 1500

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  targetValue?: number
}

export default function PortfolioHero({ targetValue = TARGET_VALUE }: Props) {
  const [displayValue, setDisplayValue] = useState(0)
  const [periodEnabled, setPeriodEnabled] = useState(true)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1)
      setDisplayValue(targetValue * easeOutCubic(progress))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        console.debug('[PortfolioHero] countUp complete, value=', targetValue)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [targetValue])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '20px 0 16px',
      }}
    >
      {/* Left — portfolio value + pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
          Стоимость портфеля
        </span>

        <motion.span
          style={{ fontSize: 48, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {formatCurrency(displayValue)}
        </motion.span>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              borderRadius: 'var(--r-pill)',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ↑ {CHANGE_PERCENT}%
          </span>
          <span
            style={{
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--r-pill)',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            +{formatCurrency(CHANGE_DOLLAR)}
          </span>
        </div>

        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          к пред. {formatCurrency(PREV_VALUE)} · 1 июн – 31 авг 2025
        </span>
      </div>

      {/* Right — period toggle + date range */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Период</span>
          <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20 }}>
            <input
              type="checkbox"
              checked={periodEnabled}
              onChange={(e) => setPeriodEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                background: periodEnabled ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            />
            <span
              style={{
                position: 'absolute',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                top: 3,
                left: periodEnabled ? 19 : 3,
                transition: 'left 0.2s',
              }}
            />
          </label>
        </div>

        <select
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 8px',
            background: 'var(--white)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          <option>1 сен – 30 ноя 2025</option>
          <option>1 июн – 31 авг 2025</option>
          <option>1 мар – 31 май 2025</option>
        </select>
      </div>
    </div>
  )
}
