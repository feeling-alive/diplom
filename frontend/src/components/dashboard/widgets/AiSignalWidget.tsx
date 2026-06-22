import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { WidgetSizeProps } from '../../../types/widgets.types'
import { usePrediction } from '../../../hooks/usePrediction'

type Props = WidgetSizeProps & { symbol?: string }

const DEFAULT_SYMBOL = 'BTC-USDT'
const ACCENT = '#7e22ce'

export default function AiSignalWidget({ gridW = 2, gridH = 2, symbol = DEFAULT_SYMBOL }: Props) {
  // Live PatchTST signal from our backend (useMock=false). Falls back to a
  // neutral mock inside the hook when the backend is unreachable.
  const { data, isLoading } = usePrediction(symbol, false)
  console.debug('[AiSignalWidget] symbol=%s gridW=%d gridH=%d data=%o', symbol, gridW, gridH, data)

  const showDetails = gridH >= 2
  const base = symbol.split('-')[0]

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 6, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: 'var(--accent-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={12} color={ACCENT} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{base}</span>
        {data && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 6px', borderRadius: 999,
            background: 'var(--accent-bg)', color: ACCENT,
            fontSize: 9, fontWeight: 700,
          }}>AI</span>
        )}
      </div>

      {isLoading ? (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Анализирую...</div>
      ) : !data ? (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Нет данных</div>
      ) : (
        <AiSignalBody data={data} showDetails={showDetails} />
      )}
    </div>
  )
}

function AiSignalBody({
  data,
  showDetails,
}: {
  data: { direction: string; probability: number; low_confidence: boolean }
  showDetails: boolean
}) {
  const isWeak = data.low_confidence || data.direction === 'SIDEWAYS'
  const trend = isWeak ? 'Боковик' : data.direction === 'UP' ? 'Восходящий' : 'Нисходящий'
  const trendColor = isWeak ? 'var(--muted)' : data.direction === 'UP' ? 'var(--pos)' : 'var(--neg)'
  const Icon = isWeak ? Minus : data.direction === 'UP' ? TrendingUp : TrendingDown
  const pct = Math.round(data.probability * 100)

  const detail = isWeak
    ? 'Сигнал слабый — модель не уверена в направлении. Дождитесь подтверждения.'
    : `Модель прогнозирует ${trend.toLowerCase()} тренд с уверенностью ${pct}%.`

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: trendColor }}>
        <Icon size={12} strokeWidth={2.5} />
        {trend}
      </div>
      {showDetails && (
        <div style={{
          fontSize: 10, color: 'var(--text)',
          padding: 6, borderRadius: 6,
          background: 'var(--bg)', lineHeight: 1.35, flex: 1, minHeight: 0,
          overflow: 'auto',
        }}>
          {detail}
        </div>
      )}
    </>
  )
}
