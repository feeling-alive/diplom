import { useState, useEffect, useRef } from 'react'
import type { Asset } from '../types/market.types'
import { MOCK_PRICES } from '../mock/prices.mock'
import { ENV } from '../lib/env'

export interface PriceMap {
  bySymbol: Record<string, Asset>
  cryptos: Asset[]
  stocks: Asset[]
  forex: Asset[]
  indices: Asset[]
  all: Asset[]
  isLoading: boolean
  lastUpdated: number
}

export function usePrices(): PriceMap {
  const [prices, setPrices] = useState<Asset[]>(() => MOCK_PRICES.map((a) => ({ ...a })))
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(0)
  const fetchId = useRef(0)

  useEffect(() => {
    const id = ++fetchId.current
    console.log('[usePrices] mounted')

    async function tick() {
      if (id !== fetchId.current) return
      const updates = new Map<string, Partial<Asset>>()

      // OKX
      try {
        const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT&limit=50')
        if (res.ok) {
          const json = await res.json() as { data: Array<{ instId: string; last: string; volCcy24h: string }> }
          for (const t of json.data ?? []) {
            updates.set(t.instId, { price: parseFloat(t.last), volume24h: Math.round(parseFloat(t.volCcy24h)) })
          }
          console.log('[usePrices] OKX: %d tickers, first: %s=$%s', json.data?.length ?? 0, json.data?.[0]?.instId, json.data?.[0]?.last)
        }
      } catch { /* ignore */ }

      // Frankfurter
      try {
        const res = await fetch(`${ENV.FRANKFURTER_BASE_URL}/latest?from=USD`)
        if (res.ok) {
          const json = await res.json() as { rates: Record<string, number> }
          for (const [ccy, rate] of Object.entries(json.rates ?? {})) {
            updates.set(`USD-${ccy}`, { price: rate })
            updates.set(`${ccy}-USD`, { price: +(1 / rate).toFixed(4) })
          }
        }
      } catch { /* ignore */ }

      // Finnhub
      if (ENV.FINNHUB_API_KEY) {
        const top = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT']
        const results = await Promise.allSettled(
          top.map(async (s) => {
            const r = await fetch(`${ENV.FINNHUB_BASE_URL}/quote?symbol=${s}&token=${ENV.FINNHUB_API_KEY}`)
            if (!r.ok) throw new Error()
            const d = await r.json() as { c: number; dp: number }
            return { symbol: s, price: d.c, change24h: d.dp }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) updates.set(r.value.symbol, { price: r.value.price, change24h: r.value.change24h })
        }
        console.log('[usePrices] Finnhub: %d stocks', results.filter((r) => r.status === 'fulfilled').length)
      }

      if (id !== fetchId.current) return

      setPrices((prev) => {
        const next = prev.map((a) => {
          const u = updates.get(a.symbol)
          if (u) return { ...a, ...u }
          // jitter for non-updated
          const jitter = 1 + (Math.random() - 0.5) * 0.01
          return { ...a, price: a.price * jitter }
        })
        console.log('[usePrices] updated, sample: %s=$%s %s=$%s', next[0]?.symbol, next[0]?.price.toFixed(2), next[1]?.symbol, next[1]?.price.toFixed(2))
        return next
      })
      setLastUpdated(Date.now())
      setIsLoading(false)
    }

    void tick()
    const interval = setInterval(() => void tick(), 15_000)
    return () => { fetchId.current = -1; clearInterval(interval) }
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
    lastUpdated,
  }
}
