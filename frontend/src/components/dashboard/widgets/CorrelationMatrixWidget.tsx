import { Fragment } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']
const MATRIX = [
  [1.00, 0.82, 0.74, 0.61, 0.45],
  [0.82, 1.00, 0.79, 0.58, 0.42],
  [0.74, 0.79, 1.00, 0.51, 0.38],
  [0.61, 0.58, 0.51, 1.00, 0.35],
  [0.45, 0.42, 0.38, 0.35, 1.00],
]

function corrColor(v: number): string {
  if (v >= 0.9) return '#065f46'
  if (v >= 0.7) return '#10b981'
  if (v >= 0.5) return '#86efac'
  if (v >= 0.3) return '#fde68a'
  if (v >= 0) return '#fed7aa'
  return '#fca5a5'
}

export default function CorrelationMatrixWidget({ gridW = 3, gridH = 2 }: Props) {
  console.debug('[CorrelationMatrixWidget] gridW=%d gridH=%d', gridW, gridH)
  const cols = SYMBOLS.length

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `auto repeat(${cols}, 1fr)`,
      gridTemplateRows: `auto repeat(${cols}, 1fr)`,
      gap: 2, overflow: 'hidden',
      alignItems: 'center', justifyItems: 'center',
      fontSize: 9, fontWeight: 600,
    }}>
      <span />
      {SYMBOLS.map((s) => (
        <span key={`h-${s}`} style={{ color: 'var(--muted)' }}>{s}</span>
      ))}
      {MATRIX.map((row, ri) => (
        <Fragment key={`row-${ri}`}>
          <span style={{ color: 'var(--muted)', paddingRight: 4 }}>{SYMBOLS[ri]}</span>
          {row.map((v, ci) => (
            <div key={`c-${ri}-${ci}`} style={{
              width: '100%', height: '100%',
              minHeight: 16,
              background: corrColor(v),
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: v >= 0.7 ? '#fff' : 'var(--ink)',
              fontSize: 9, fontWeight: 700,
            }}>
              {v.toFixed(2)}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}
