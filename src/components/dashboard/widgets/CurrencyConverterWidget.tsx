import { useState } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const RATE_USD_RUB = 92.4

export default function CurrencyConverterWidget({ gridW = 2, gridH = 2 }: Props) {
  const [amount, setAmount] = useState('100')
  const result = (parseFloat(amount) || 0) * RATE_USD_RUB
  console.debug('[CurrencyConverterWidget] gridW=%d gridH=%d', gridW, gridH)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--bg)', padding: '6px 8px', borderRadius: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>USD</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, fontWeight: 700, color: 'var(--ink)',
            textAlign: 'right', minWidth: 0, fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>↓ 1 USD = {RATE_USD_RUB} ₽</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#dcfce7', padding: '6px 8px', borderRadius: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>RUB</span>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 700, color: '#16a34a',
          textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{result.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  )
}
