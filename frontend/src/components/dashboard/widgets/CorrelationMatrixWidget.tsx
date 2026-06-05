import { Fragment, useMemo } from 'react'
import { useOHLCV } from '../../../hooks/useOHLCV'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const PAIRS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT']
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']

function corrColor(v: number): string {
  if (v >= 0.9) return '#065f46'
  if (v >= 0.7) return '#10b981'
  if (v >= 0.5) return '#86efac'
  if (v >= 0.3) return '#fde68a'
  if (v >= 0) return '#fed7aa'
  return '#fca5a5'
}

// Pearson correlation of two equal-length series.
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const x = xs.slice(-n)
  const y = ys.slice(-n)
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i]! - mx
    const b = y[i]! - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const denom = Math.sqrt(dx * dy)
  return denom === 0 ? 0 : num / denom
}

export default function CorrelationMatrixWidget({ gridW = 3, gridH = 2 }: Props) {
  // Five fixed hook calls (hook order stays stable). Daily closes, 90 points.
  const btc = useOHLCV(PAIRS[0]!, '1D')
  const eth = useOHLCV(PAIRS[1]!, '1D')
  const sol = useOHLCV(PAIRS[2]!, '1D')
  const bnb = useOHLCV(PAIRS[3]!, '1D')
  const xrp = useOHLCV(PAIRS[4]!, '1D')

  const matrix = useMemo(() => {
    const series = [btc, eth, sol, bnb, xrp].map((q) => q.data.map((p) => p.close))
    return series.map((a) => series.map((b) => pearson(a, b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btc.data, eth.data, sol.data, bnb.data, xrp.data])

  const ready = matrix[0]?.[1] !== undefined
  console.debug('[CorrelationMatrixWidget] gridW=%d gridH=%d computed=%dx%d', gridW, gridH, matrix.length, matrix.length)
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
      {matrix.map((row, ri) => (
        <Fragment key={`row-${ri}`}>
          <span style={{ color: 'var(--muted)', paddingRight: 4 }}>{SYMBOLS[ri]}</span>
          {row.map((v, ci) => (
            <div key={`c-${ri}-${ci}`} style={{
              width: '100%', height: '100%',
              minHeight: 16,
              background: ready ? corrColor(v) : 'var(--bg)',
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: v >= 0.7 ? '#fff' : 'var(--ink)',
              fontSize: 9, fontWeight: 700,
            }}>
              {ready ? (ri === ci ? '1.00' : v.toFixed(2)) : '·'}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}
