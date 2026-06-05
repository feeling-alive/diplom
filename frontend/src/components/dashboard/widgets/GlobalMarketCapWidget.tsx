import { useState, useEffect, useMemo } from 'react'
import type { WidgetSizeProps } from '../../../types/widgets.types'

type Props = WidgetSizeProps

const CACHE_KEY = 'fintrack_global_market_v1'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface GlobalData {
  totalCap: number
  totalVolume: number
  btcDominance: number
  ethDominance: number
  marketCapChange24h: number
  volumeChange24h: number
  timestamp: number
}

interface CacheEntry extends GlobalData { cachedAt: number }
function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function writeCache(data: GlobalData) {
  try {
    const entry = { ...data, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    /* ignore */
  }
}

export default function GlobalMarketCapWidget({ gridW = 2, gridH = 1 }: Props) {
  const [data, setData] = useState<GlobalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      console.info('[GlobalMarketCapWidget] cache hit — cap=%.2fT vol=%.2fT', cached.totalCap, cached.totalVolume)
      setData(cached)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const fetchFn = async () => {
      try {
        console.info('[GlobalMarketCapWidget] fetching CoinGecko /global')
        const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: controller.signal })
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
        const json = (await res.json()) as {
          data: {
            total_market_cap: { usd: number }
            total_volume: { usd: number }
            market_cap_percentage: { btc: number; eth: number }
            market_cap_change_percentage_24h_usd: number
          }
        }
        const d = json.data
        const totalCap = d.total_market_cap.usd / 1e12
        const totalVolume = d.total_volume.usd / 1e12
        const next: GlobalData = {
          totalCap,
          totalVolume,
          btcDominance: d.market_cap_percentage.btc,
          ethDominance: d.market_cap_percentage.eth,
          marketCapChange24h: d.market_cap_change_percentage_24h_usd,
          volumeChange24h: 0,
          timestamp: Date.now(),
        }
        setData(next)
        writeCache(next)
        console.info('[GlobalMarketCapWidget] fetched cap=%.2fT vol=%.2fT btc=%.2f%%', totalCap, totalVolume, next.btcDominance)
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('[GlobalMarketCapWidget] fetch failed, using fallback:', err)
        setData({
          totalCap: 2.43, totalVolume: 98.5,
          btcDominance: 52.4, ethDominance: 17.2,
          marketCapChange24h: 1.8, volumeChange24h: 0,
          timestamp: Date.now(),
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchFn()
    return () => controller.abort()
  }, [])

  if (isLoading && !data) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11 }}>Загрузка…</div>
  }

  const showAll = gridH >= 2 || gridW >= 3
  const positive = (data?.marketCapChange24h ?? 0) >= 0

  console.debug('[GlobalMarketCapWidget] gridW=%d gridH=%d showAll=%s', gridW, gridH, showAll)

  if (!data) return null

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: showAll ? 'column' : 'row',
      alignItems: 'center', gap: showAll ? 6 : 12,
      overflow: 'hidden', padding: 4,
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Капитализация</div>
        <div style={{ fontSize: showAll ? 18 : 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          ${data.totalCap.toFixed(2)}T
        </div>
      </div>
      {showAll && (
        <>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Объём 24ч</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              ${data.totalVolume.toFixed(1)}B
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>BTC дом.</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {data.btcDominance.toFixed(1)}%
            </div>
          </div>
        </>
      )}
      <div style={{
        padding: '3px 8px', borderRadius: 999,
        background: positive ? '#dcfce7' : '#fee2e2',
        color: positive ? '#16a34a' : '#dc2626',
        fontSize: 10, fontWeight: 700, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {positive ? '+' : ''}{data.marketCapChange24h.toFixed(1)}%
      </div>
    </div>
  )
}
