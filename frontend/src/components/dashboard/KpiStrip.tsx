import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHoldings } from '../../hooks/useHoldings'

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const PERIODS = ['1Ч', '1Д', '1М'] as const
type Period = typeof PERIODS[number]

export default function KpiStrip() {
  const [period, setPeriod] = useState<Period>('1Д')
  const { totalValue, totalCost, totalPnl, pnlPercent, isEmpty } = useHoldings()

  const totalPrice = totalValue
  const prevTotal = totalCost
  const changePercent = pnlPercent
  const isPositive = changePercent >= 0
  const changeDollar = totalPnl

  console.debug('[KpiStrip] period=%s total=%.2f change=%s%% empty=%s', period, totalPrice, changePercent.toFixed(1), isEmpty)

  if (isEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 0 16px' }}
      >
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>Портфель</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>$0</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Добавьте активы, чтобы увидеть статистику портфеля</span>
      </motion.div>
    )
  }

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
          вложено {formatCurrency(prevTotal)} · P&L за всё время
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
