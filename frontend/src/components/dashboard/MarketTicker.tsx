import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePrices } from '../../hooks/usePrices'
import { formatPrice, formatChange } from '../../utils/format'
import type { Asset } from '../../types/market.types'
import type { WidgetSizeProps } from '../../types/widgets.types'

type Props = WidgetSizeProps

// Подбираем «витрину» популярных активов разных типов, чтобы тикер выглядел осмысленно
// даже когда виджет узкий (2×1 — 4 элемента).
const PREFERRED_SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'ADA-USDT',
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

// dense — узкие ячейки (3×1/2×1): прячем пилюлю %, показываем компактную иконку +
// символ (ellipsis, flexShrink:1) + цену (flexShrink:0), чтобы ничего не наезжало и не
// обрезалось криво (Задача B2). Цвет цены кодирует знак изменения вместо пилюли.
// round 3 (A2): иконку актива вернули и в плотном режиме (раньше она пряталась) —
// просто меньшего размера, flexShrink:0, чтобы раскладка не ломалась.
function AssetCell({ asset, onClick, dense }: { asset: Asset; onClick: () => void; dense: boolean }) {
  const positive = asset.change24h >= 0
  const iconSize = dense ? 16 : 22
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: dense ? 4 : 6,
        padding: dense ? '4px 6px' : '6px 8px',
        minWidth: 0,
        borderRadius: 8,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: '50%',
          background: asset.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: dense ? 9 : 10,
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
          flex: '1 1 auto',
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
          color: dense ? (positive ? 'var(--pos)' : 'var(--neg)') : 'var(--text)',
          marginLeft: 'auto',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatPrice(asset.price, asset.type)}
      </span>
      {!dense && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: positive ? 'var(--pos)' : 'var(--neg)',
            background: positive ? 'var(--pos-bg)' : 'var(--neg-bg)',
            padding: '2px 6px',
            borderRadius: 999,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatChange(asset.change24h)}
        </span>
      )}
    </motion.div>
  )
}

export default function MarketTicker({ gridW = 3, gridH = 1 }: Props) {
  const { all } = usePrices()
  const navigate = useNavigate()

  const rows = Math.max(1, gridH)
  const cols = Math.max(2, gridW)
  const desired = rows * cols
  const assets = useMemo(() => pickTopAssets(all, desired), [all, desired])

  // Узкие ячейки: при 3+ колонках на каждую приходится ~1/3 ширины виджета — там
  // аватар + цена + пилюля % не помещаются, поэтому переходим в плотный режим.
  const dense = cols >= 3

  console.debug('[MarketTicker] gridW=%d gridH=%d cells=%d dense=%s', gridW, gridH, assets.length, dense)

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
        <AssetCell key={a.symbol} asset={a} dense={dense} onClick={() => {
          console.debug('[MarketTicker] navigating to /asset/%s', a.symbol)
          navigate(`/asset/${a.symbol}`)
        }} />
      ))}
    </div>
  )
}
