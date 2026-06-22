import { useState, type CSSProperties } from 'react'
import { useForexRate } from '../../../hooks/useForexRate'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY']

const selectStyle: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', border: 'none',
  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}

export default function CurrencyConverterWidget({ gridW = 2, gridH = 2 }: Props) {
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('RUB')

  const { rate, isLoading } = useForexRate(from, to)
  const result = (parseFloat(amount) || 0) * rate
  console.debug('[CurrencyConverterWidget] gridW=%d gridH=%d %s->%s rate=%f', gridW, gridH, from, to, rate)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--bg)', padding: '6px 8px', borderRadius: 8,
      }}>
        <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>
        ↓ 1 {from} = {isLoading || !rate ? '…' : rate.toLocaleString('ru-RU', { maximumFractionDigits: 4 })} {to}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--pos-bg)', padding: '6px 8px', borderRadius: 8,
      }}>
        <select value={to} onChange={(e) => setTo(e.target.value)} style={{ ...selectStyle, color: 'var(--pos)' }}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--pos)',
          textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{result.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  )
}
