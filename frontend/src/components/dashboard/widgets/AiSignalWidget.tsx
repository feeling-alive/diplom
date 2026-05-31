import { Sparkles } from 'lucide-react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const SIGNAL = {
  symbol: 'BTC',
  trend: 'Восходящий',
  recommendation: 'Покупать на откатах',
  confidence: 78,
  color: '#7e22ce',
}

export default function AiSignalWidget({ gridW = 2, gridH = 2 }: Props) {
  console.debug('[AiSignalWidget] gridW=%d gridH=%d', gridW, gridH)
  const showDetails = gridH >= 2

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 6, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: '#f3e8ff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={12} color={SIGNAL.color} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{SIGNAL.symbol}</span>
        <span style={{
          marginLeft: 'auto',
          padding: '2px 6px', borderRadius: 999,
          background: '#f3e8ff', color: SIGNAL.color,
          fontSize: 9, fontWeight: 700,
        }}>AI {SIGNAL.confidence}%</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: SIGNAL.color }}>{SIGNAL.trend}</div>
      {showDetails && (
        <div style={{
          fontSize: 10, color: 'var(--text)',
          padding: 6, borderRadius: 6,
          background: 'var(--bg)', lineHeight: 1.35, flex: 1, minHeight: 0,
          overflow: 'auto',
        }}>
          {SIGNAL.recommendation}. Подтверждено MA-50 и RSI&nbsp;14. Стоп ниже последнего минимума.
        </div>
      )}
    </div>
  )
}
