import { useMemo } from 'react'
import { usePrices } from '../../hooks/usePrices'
import { formatPrice, formatChange } from '../../utils/format'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'

type Props = WidgetSizeProps

// Подбираем «витрину» популярных активов разных типов, чтобы тикер выглядел осмысленно
// даже когда виджет узкий (2×1 — 4 элемента).
const PREFERRED_SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT',
  'AAPL', 'NVDA', 'MSFT', 'TSLA',
  'EUR-USD', 'GBP-USD', 'USD-JPY', 'USD-CNY',
]

function pickTopAssets(all: Asset[], desired: number): Asset[] {
  const bySymbol = new Map<string, Asset>(all.map((a) => [a.symbol, a]))
  const out: Asset[] = []
  for (const s of PREFERRED_SYMBOLS) {
    const a = bySymbol.get(s)
    if (a) out.push(a)
    if (out.length >= desired) break
  }
  // добор обычными активами если в preferred не хватило
  if (out.length < desired) {
    const used = new Set(out.map((a) => a.symbol))
    for (const a of all) {
      if (used.has(a.symbol)) continue
      out.push(a)
      if (out.length >= desired) break
    }
  }
  return out.slice(0, desired)
}

function AssetCell({ asset }: { asset: Asset }) {
  const positive = asset.change24h >= 0
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        minWidth: 0,
        borderRadius: 8,
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: asset.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {asset.icon ?? asset.symbol[0]}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--ink)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {asset.symbol.split('-')[0]}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text)',
          marginLeft: 'auto',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatPrice(asset.price, asset.type)}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: positive ? 'var(--green)' : 'var(--accent)',
          background: positive ? '#E8F8EF' : 'var(--accent-bg)',
          padding: '2px 6px',
          borderRadius: 999,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatChange(asset.change24h)}
      </span>
    </div>
  )
}

export default function MarketTicker({ gridW = 3, gridH = 1 }: Props) {
  const { all } = usePrices()

  const rows = Math.max(1, gridH)
  const cols = Math.max(2, gridW)
  const desired = rows * cols
  const assets = useMemo(() => pickTopAssets(all, desired), [all, desired])

  console.debug('[MarketTicker] gridW=%d gridH=%d cells=%d', gridW, gridH, assets.length)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: '1fr',
        gap: 6,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {assets.map((a) => (
        <AssetCell key={a.symbol} asset={a} />
      ))}
    </div>
  )
}
