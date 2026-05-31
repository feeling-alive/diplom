import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MOCK_PRICES } from '../../mock/prices.mock'

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const PERIODS = ['1Ч', '1Д', '1М'] as const
type Period = typeof PERIODS[number]

export default function KpiStrip() {
  const [period, setPeriod] = useState<Period>('1Д')

  const totalPrice = useMemo(
    () => MOCK_PRICES.slice(0, 4).reduce((sum, a) => sum + a.price * 10, 0),
    [],
  )
  const prevTotal = totalPrice * 0.997
  const changePercent = ((totalPrice - prevTotal) / prevTotal) * 100
  const isPositive = changePercent >= 0
  const changeDollar = totalPrice - prevTotal

  console.debug('[KpiStrip] period=%s total=%d change=%s%', period, totalPrice, changePercent.toFixed(1))

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '20px 0 16px',
      }}
    >
      {/* Left — value + pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
          Портфель за {period}
        </span>

        <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
          {formatCurrency(totalPrice)}
        </span>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Percent pill */}
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
            {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
          {/* Dollar pill */}
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
          к пред. {formatCurrency(prevTotal)} · за {period}
        </span>
      </div>

      {/* Right — period toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {PERIODS.map((p) => {
          const active = period === p
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
