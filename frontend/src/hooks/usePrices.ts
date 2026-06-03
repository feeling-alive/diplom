import { useState, useEffect, useRef } from 'react'
import type { Asset } from '../types/market.types'
import INITIAL_PRICES from '../data/prices.json'

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

const INITIAL: Asset[] = INITIAL_PRICES as Asset[]

export function usePrices(): PriceMap {
  const [prices, setPrices] = useState<Asset[]>(INITIAL)
  const [lastUpdated, setLastUpdated] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    async function tick() {
      if (!mounted.current) return
      const updates = new Map<string, Partial<Asset>>()

      try {
        const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT&limit=50')
        if (res.ok) {
          const json = await res.json() as { data: Array<{ instId: string; last: string; volCcy24h: string }> }
          for (const t of json.data ?? []) updates.set(t.instId, { price: parseFloat(t.last), volume24h: Math.round(parseFloat(t.volCcy24h)) })
        }
      } catch { /* okx fail */ }

      try {
        const forexSymbols: Array<[string, string]> = [
          ['USD','EUR'],['USD','GBP'],['USD','JPY'],['USD','CHF'],
          ['USD','CAD'],['USD','AUD'],['USD','CNY'],['USD','RUB'],
          ['EUR','USD'],['GBP','USD'],
        ]
        const forexResults = await Promise.allSettled(
          forexSymbols.map(async ([from, to]) => {
            const r = await fetch(`/api/quotes/forex/${from}/${to}`)
            if (!r.ok) throw new Error(`${r.status}`)
            const d = await r.json() as { rate: number }
            return { from, to, rate: d.rate }
          })
        )
        for (const r of forexResults) {
          if (r.status === 'fulfilled' && r.value) {
            const { from, to, rate } = r.value
            updates.set(`${from}-${to}`, { price: rate })
          }
        }
      } catch { /* forex fail */ }

      {
        const symbols = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','V','WMT']
        const results = await Promise.allSettled(
          symbols.map(async (s) => {
            const r = await fetch(`/api/quotes/stock/${s}`, { signal: AbortSignal.timeout(4000) })
            if (!r.ok) throw new Error(`${r.status}`)
            const d = await r.json() as { price: number; changePercent: number }
            return { symbol: s, price: d.price, change24h: d.changePercent }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) updates.set(r.value.symbol, { price: r.value.price, change24h: r.value.change24h })
        }
      }

      if (!mounted.current) return

      setPrices((prev) => prev.map((a) => {
        const u = updates.get(a.symbol)
        if (u) return { ...a, ...u }
        // [FIX Задача 3] Индексы (SPX/DJI/IXIC/DAX/NKY/USOIL/UKOIL) не имеют
        // бесплатного живого источника — Finnhub free их не отдаёт. Без этого
        // guard'а к статичному снимку применялся случайный jitter → SPX «дрожал»
        // вокруг ~5842. Оставляем снимок стабильным.
        if (a.type === 'index') return a
        const j = 1 + (Math.random() - 0.5) * 0.01
        return { ...a, price: a.price * j }
      }))
      setLastUpdated(Date.now())
    }

    void tick()
    const interval = setInterval(() => void tick(), 60_000)
    return () => { mounted.current = false; clearInterval(interval) }
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
    isLoading: lastUpdated === 0,
    lastUpdated,
  }
}
