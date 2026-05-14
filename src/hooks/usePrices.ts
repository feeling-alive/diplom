import { useState, useEffect } from 'react'
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

function mergeAssets(mock: Asset[], updates: Map<string, Partial<Asset>>): Asset[] {
  return mock.map((a) => {
    const u = updates.get(a.symbol)
    return u ? { ...a, ...u } : a
  })
}

export function usePrices(): PriceMap {
  const [livePrices, setLivePrices] = useState<Map<string, Partial<Asset>>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (USE_MOCK) { setIsLoading(false); return }

    let cancelled = false
    const updates = new Map<string, Partial<Asset>>()

    Promise.all([
      // 1. Crypto — OKX tickers (через Vite proxy если нужно)
      (async () => {
        try {
          const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
          if (!res.ok) throw new Error(`OKX ${res.status}`)
          const json = await res.json() as { data: Array<{ instId: string; last: string; volCcy24h: string; change24h?: string }> }
          for (const t of json.data ?? []) {
            const symbol = t.instId.replace('-', '-') + '-USDT'
            updates.set(t.instId, { price: parseFloat(t.last), volume24h: parseFloat(t.volCcy24h) ?? 0 })
          }
          console.info('[usePrices] OKX tickers loaded: %d', json.data?.length ?? 0)
        } catch (err) {
          console.warn('[usePrices] OKX failed:', err)
        }
      })(),

      // 2. Forex — Frankfurter
      (async () => {
        try {
          const res = await fetch(`${ENV.FRANKFURTER_BASE_URL}/latest?from=USD`)
          if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
          const json = await res.json() as { rates: Record<string, number> }
          for (const [ccy, rate] of Object.entries(json.rates ?? {})) {
            const symbol = `USD-${ccy}`
            updates.set(symbol, { price: rate })
            updates.set(`${ccy}-USD`, { price: 1 / rate })
          }
          console.info('[usePrices] Frankfurter rates loaded: %d', Object.keys(json.rates ?? {}).length)
        } catch (err) {
          console.warn('[usePrices] Frankfurter failed:', err)
        }
      })(),

      // 3. Stocks — Finnhub основные
      (async () => {
        if (!ENV.FINNHUB_API_KEY) return
        const top = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT', 'JNJ', 'XOM', 'PG', 'KO', 'DIS', 'NFLX', 'ADBE', 'CRM', 'AMD', 'INTC']
        const results = await Promise.allSettled(
          top.map(async (s) => {
            const res = await fetch(`${ENV.FINNHUB_BASE_URL}/quote?symbol=${s}&token=${ENV.FINNHUB_API_KEY}`)
            if (!res.ok) throw new Error(`Finnhub ${s} ${res.status}`)
            const json = await res.json() as { c: number; dp: number; h: number; l: number }
            return { symbol: s, price: json.c, change24h: json.dp, high24h: json.h, low24h: json.l }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            updates.set(r.value.symbol, { price: r.value.price, change24h: r.value.change24h, high24h: r.value.high24h, low24h: r.value.low24h })
          }
        }
        console.info('[usePrices] Finnhub stocks loaded: %d', results.filter((r) => r.status === 'fulfilled').length)
      })(),
    ]).then(() => {
      if (!cancelled) {
        setLivePrices(updates)
        setIsLive(updates.size > 0)
        setIsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const merged = mergeAssets(MOCK_PRICES, livePrices)
  const bySymbol: Record<string, Asset> = {}
  for (const a of merged) bySymbol[a.symbol] = a

  return {
    bySymbol,
    cryptos: merged.filter((a) => a.type === 'crypto'),
    stocks: merged.filter((a) => a.type === 'stock'),
    forex: merged.filter((a) => a.type === 'forex'),
    indices: merged.filter((a) => a.type === 'index'),
    all: merged,
    isLoading,
    isLive,
  }
}
