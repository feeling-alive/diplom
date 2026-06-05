import { useQuery } from '@tanstack/react-query'
import { USE_MOCK } from '../../../lib/env'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

interface GasTier { gwei: number; usd: number }
interface GasPayload {
  slow: GasTier; standard: GasTier; fast: GasTier
  baseFee: number; isStale?: boolean
}

const FALLBACK: GasPayload = {
  slow: { gwei: 18, usd: 1.1 }, standard: { gwei: 24, usd: 1.45 }, fast: { gwei: 32, usd: 1.95 },
  baseFee: 20, isStale: true,
}

async function fetchGas(): Promise<GasPayload> {
  const res = await fetch('/api/quotes/gas')
  if (!res.ok) throw new Error(`gas ${res.status}`)
  const json = (await res.json()) as GasPayload
  console.debug('[GasTrackerWidget] slow=%d std=%d fast=%d stale=%s', json.slow.gwei, json.standard.gwei, json.fast.gwei, json.isStale)
  return json
}

export default function GasTrackerWidget({ gridW = 2, gridH = 1 }: Props) {
  const { data } = useQuery<GasPayload, Error>({
    queryKey: ['gas'],
    queryFn: fetchGas,
    enabled: !USE_MOCK,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })
  const gas = data ?? FALLBACK
  const tiers = [
    { label: 'Slow', gwei: gas.slow.gwei, color: '#22c55e' },
    { label: 'Std', gwei: gas.standard.gwei, color: '#f59e0b' },
    { label: 'Fast', gwei: gas.fast.gwei, color: '#ef4444' },
  ]
  console.debug('[GasTrackerWidget] gridW=%d gridH=%d stale=%s', gridW, gridH, gas.isStale)

  const compact = gridW < 2 && gridH < 2
  if (compact) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{gas.standard.gwei}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>gwei · ETH</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 6,
      }}>
        {tiers.map((t) => (
          <div key={t.label} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.label}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: t.color }}>{t.gwei}</span>
            <span style={{ fontSize: 8, color: 'var(--muted)' }}>gwei</span>
          </div>
        ))}
      </div>
      {gas.isStale && (
        <div style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'center', flexShrink: 0 }}>
          демо-данные (нет API-ключа)
        </div>
      )}
    </div>
  )
}
