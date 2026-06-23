import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../../../lib/env'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Row = { symbol: string; rate: number } // rate in percent (e.g. 0.012 = 0.012%)

// Расширенный список перп-свопов OKX (3.5) — узкий виджет покажет верхушку,
// широкий/высокий — весь список со скроллом.
const SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT', 'BNB-USDT',
  'ADA-USDT', 'AVAX-USDT', 'LINK-USDT', 'DOT-USDT', 'LTC-USDT', 'TRX-USDT',
]

const MOCK_ROWS: Row[] = [
  { symbol: 'BTC', rate: 0.012 }, { symbol: 'ETH', rate: 0.008 },
  { symbol: 'SOL', rate: 0.024 }, { symbol: 'XRP', rate: -0.005 },
  { symbol: 'DOGE', rate: 0.041 }, { symbol: 'BNB', rate: 0.003 },
  { symbol: 'ADA', rate: 0.006 }, { symbol: 'AVAX', rate: 0.015 },
  { symbol: 'LINK', rate: 0.009 }, { symbol: 'DOT', rate: -0.002 },
  { symbol: 'LTC', rate: 0.004 }, { symbol: 'TRX', rate: 0.007 },
]

interface FundingPayload {
  rates: Array<{ symbol: string; fundingRatePercent: number }>
}

async function fetchFunding(): Promise<Row[]> {
  const res = await fetch(`/api/quotes/funding-rate?symbols=${SYMBOLS.join(',')}`)
  if (!res.ok) throw new Error(`funding-rate ${res.status}`)
  const json = (await res.json()) as FundingPayload
  const rows = json.rates.map((r) => ({ symbol: r.symbol.replace('-USDT', ''), rate: r.fundingRatePercent }))
  console.debug('[FundingRateWidget] fetched %d rates', rows.length)
  return rows
}

type Props = WidgetSizeProps

export default function FundingRateWidget({ gridW = 2, gridH = 2 }: Props) {
  // Чем больше виджет — тем больше строк: высокий/широкий показывает весь список.
  const limit = gridH >= 3 ? SYMBOLS.length : gridW >= 3 ? 8 : gridH >= 2 ? 6 : 4
  const { data } = useQuery<Row[], Error>({
    queryKey: ['funding-rate', SYMBOLS.join(',')],
    queryFn: fetchFunding,
    enabled: !USE_MOCK,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  })
  const rows = (USE_MOCK ? MOCK_ROWS : data) ?? MOCK_ROWS
  console.debug('[FundingRateWidget] gridW=%d gridH=%d rows=%d', gridW, gridH, rows.length)

  return (
    <div
      title="Funding rate — ставка финансирования перпетуальных свопов (раз в 8ч). Положительная: лонги платят шортам (бычий настрой), отрицательная: шорты платят лонгам."
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: 'var(--muted)', fontWeight: 600,
        padding: '2px 0', borderBottom: '1px solid var(--border)',
      }}>
        <span>Актив</span><span title="Ставка финансирования перпов — настрой рынка">Funding · 8ч</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.slice(0, limit).map((r) => (
          <div key={r.symbol} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '5px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{r.symbol}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.rate >= 0 ? '#16a34a' : '#ef4444' }}>
              {r.rate >= 0 ? '+' : ''}{r.rate.toFixed(4)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
