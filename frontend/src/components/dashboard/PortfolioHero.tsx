import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useHoldings } from '../../hooks/useHoldings'
import { convertFromUsd, getCurrencyState, CURRENCY_SYMBOL } from '../../utils/format'

const ANIMATION_DURATION = 1500

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Портфельная сумма в USD → конвертируем под выбранную валюту (Задача 4.1).
function formatCurrency(usd: number): string {
  const { currency } = getCurrencyState()
  const v = convertFromUsd(usd)
  const digits = currency === 'BTC' ? 4 : 2
  const num = v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const sym = CURRENCY_SYMBOL[currency]
  return currency === 'RUB' ? `${num} ${sym}` : `${sym}${num}`
}

interface Props {
  targetValue?: number
}

export default function PortfolioHero({ targetValue }: Props) {
  const { totalValue, totalCost, totalPnl, pnlPercent, isEmpty } = useHoldings()
  const target = targetValue ?? totalValue
  const changePercent = pnlPercent
  const changeDollar = totalPnl
  const prevValue = totalCost
  const isPositive = changeDollar >= 0

  const [displayValue, setDisplayValue] = useState(0)
  const [periodEnabled, setPeriodEnabled] = useState(true)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startTimeRef.current = null
    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1)
      setDisplayValue(target * easeOutCubic(progress))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        console.debug('[PortfolioHero] countUp complete, value=%.2f', target)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target])

  if (isEmpty) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 0 16px' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>Стоимость портфеля</span>
        <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>$0.00</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Добавьте активы в портфель, чтобы видеть стоимость и доходность
        </span>
      </div>
    )
  }

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
            {isPositive ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}%
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
            {isPositive ? '+' : ''}{formatCurrency(changeDollar)}
          </span>
        </div>

        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          вложено {formatCurrency(prevValue)} · P&L за всё время
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
