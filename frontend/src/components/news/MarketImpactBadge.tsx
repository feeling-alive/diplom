import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

// Shared market-impact pill used by the news feed (NewsCard) and the asset-page
// news bridge (NewsPanel). lucide icons only — no emoji in production code
// (.ai-factory/RULES.md / rules/base.md).
const MAP: Record<string, { label: string; color: string; bg: string; Icon: typeof TrendingUp }> = {
  positive: { label: 'Позитивно', color: '#16a34a', bg: '#dcfce7', Icon: TrendingUp },
  negative: { label: 'Негативно', color: '#dc2626', bg: '#fee2e2', Icon: TrendingDown },
  neutral:  { label: 'Нейтрально', color: '#6b7280', bg: '#f3f4f6', Icon: Minus },
}

interface Props {
  impact: string | null
  /** Compact = icon only (no text label), for tight rows like the asset panel. */
  compact?: boolean
}

export default function MarketImpactBadge({ impact, compact = false }: Props) {
  if (!impact) return null
  const style = MAP[impact] ?? MAP.neutral
  const { Icon } = style
  return (
    <span
      title={style.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, padding: compact ? '2px 6px' : '2px 8px',
        borderRadius: 999, color: style.color, background: style.bg, flexShrink: 0,
      }}
    >
      <Icon size={11} />
      {!compact && style.label}
    </span>
  )
}
