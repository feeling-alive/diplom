import { useState, useEffect, useRef } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import { ENV, USE_MOCK } from '../lib/env'

export interface PriceMap {
  bySymbol: Record<string, Asset>
  cryptos: Asset[]
  stocks: Asset[]
  forex: Asset[]
  indices: Asset[]
  all: Asset[]
  isLoading: boolean
  isLive: boolean
}

function jitter(value: number, pct = 0.5): number {
  const factor = 1 + (Math.random() - 0.5) * 0.02 * pct
  return value * factor
}

export function usePrices(): PriceMap {
  const [prices, setPrices] = useState<Asset[]>(MOCK_PRICES)
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    console.log('[usePrices] mounted, USE_MOCK=%s', USE_MOCK)

    let cancelled = false

    async function fetchAll() {
      const updates = new Map<string, Partial<Asset>>()
      let anyLive = false

      // 1. Crypto via OKX
      try {
        const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT&limit=50')
        if (res.ok) {
          const json = await res.json() as { data: Array<{ instId: string; last: string; volCcy24h: string }> }
          for (const t of json.data ?? []) {
            updates.set(t.instId, { price: parseFloat(t.last), volume24h: parseFloat(t.volCcy24h) ?? 0 })
          }
          anyLive = true
          console.info('[usePrices] OKX: %d tickers', json.data?.length ?? 0)
        }
      } catch { /* okx not available */ }

      // 2. Forex via Frankfurter  
      try {
        const res = await fetch(`${ENV.FRANKFURTER_BASE_URL}/latest?from=USD`)
        if (res.ok) {
          const json = await res.json() as { rates: Record<string, number> }
          for (const [ccy, rate] of Object.entries(json.rates ?? {})) {
            updates.set(`USD-${ccy}`, { price: rate })
            updates.set(`${ccy}-USD`, { price: 1 / rate })
          }
          anyLive = true
          console.info('[usePrices] Frankfurter: %d rates', Object.keys(json.rates ?? {}).length)
        }
      } catch { /* frankfurter not available */ }

      // 3. Stocks via Finnhub
      if (ENV.FINNHUB_API_KEY) {
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT']
        const results = await Promise.allSettled(
          symbols.map(async (s) => {
            const r = await fetch(`${ENV.FINNHUB_BASE_URL}/quote?symbol=${s}&token=${ENV.FINNHUB_API_KEY}`)
            if (!r.ok) throw new Error()
            const d = await r.json() as { c: number; dp: number; h: number; l: number }
            return { symbol: s, price: d.c, change24h: d.dp }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            updates.set(r.value.symbol, { price: r.value.price, change24h: r.value.change24h })
          }
        }
        const loaded = results.filter((r) => r.status === 'fulfilled').length
        if (loaded > 0) { anyLive = true; console.info('[usePrices] Finnhub: %d stocks', loaded) }
      }

      if (!cancelled) {
        if (anyLive) {
          setPrices((prev) => prev.map((a) => {
            const u = updates.get(a.symbol)
            return u ? { ...a, ...u } : { ...a, price: jitter(a.price, 2), change24h: a.change24h + (Math.random() - 0.5) * 0.5 }
          }))
          setIsLive(true)
        } else {
          setPrices((prev) => prev.map((a) => ({ ...a, price: jitter(a.price, 5), change24h: a.change24h + (Math.random() - 0.5) * 0.5 })))
        }
        setIsLoading(false)
      }
    }

    void fetchAll()

    // Tick every 30s for slight variation
    intervalRef.current = setInterval(() => {
      if (!cancelled) {
        setPrices((prev) => prev.map((a) => ({ ...a, price: jitter(a.price, 1), change24h: a.change24h + (Math.random() - 0.5) * 0.2 })))
      }
    }, 30_000)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const bySymbol: Record<string, Asset> = {}
  for (const a of prices) bySymbol[a.symbol] = a

  return {
    bySymbol,
    cryptos: prices.filter((a) => a.type === 'crypto'),
    stocks: prices.filter((a) => a.type === 'stock'),
    forex: prices.filter((a) => a.type === 'forex'),
    indices: prices.filter((a) => a.type === 'index'),
    all: prices,
    isLoading,
    isLive,
  }
}
