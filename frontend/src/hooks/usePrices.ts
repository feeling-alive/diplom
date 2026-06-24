import { useQuery } from '@tanstack/react-query'
import type { Asset } from '../types/market.types'
import INITIAL_PRICES from '../data/prices.json'

export interface PriceMap {
  bySymbol: Record<string, Asset>
  cryptos: Asset[]
  stocks: Asset[]
  forex: Asset[]
  all: Asset[]
  isLoading: boolean
  lastUpdated: number
}

const INITIAL: Asset[] = INITIAL_PRICES as Asset[]

// One fetch cycle: pull live OKX spot tickers, backend-proxied forex rates and a
// handful of stock quotes, then merge them onto the static snapshot. Returns a
// fresh Asset[] (pure — no component state), which is what TanStack Query caches.
async function fetchAllPrices(): Promise<Asset[]> {
  const updates = new Map<string, Partial<Asset>>()

  try {
    // Backend batch proxy (Redis-cached, one upstream OKX call) — replaces the
    // direct browser->okx.com fetch that failed on CORS/blocked networks and
    // left crypto prices frozen on the static snapshot.
    const cryptoSymbols = INITIAL.filter((a) => a.type === 'crypto').map((a) => a.symbol)
    const res = await fetch(`/api/quotes/cryptos?symbols=${encodeURIComponent(cryptoSymbols.join(','))}`)
    if (res.ok) {
      const json = await res.json() as { tickers: Array<{ symbol: string; price: number; changePercent: number; volume: number }> }
      for (const t of json.tickers ?? []) {
        updates.set(t.symbol, { price: t.price, change24h: t.changePercent, volume24h: t.volume })
      }
      console.debug('[usePrices] crypto via backend: %d tickers', json.tickers?.length ?? 0)
    } else {
      console.warn('[usePrices] crypto backend %d — using snapshot', res.status)
    }
  } catch (e) { console.warn('[usePrices] crypto backend failed — using snapshot', e) }

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
    const symbols = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','V']
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

  return INITIAL.map((a) => {
    const u = updates.get(a.symbol)
    if (u) return { ...a, ...u }
    // Без jitter: тот же символ должен показывать одинаковую цену в обзоре рынка и на
    // странице актива (оба берут /api/quotes/stock — один источник). Случайный jitter
    // ранее давал расхождение вида $379 vs $414 на каждом рефетче (баг #6). Активы без
    // живого источника показывают детерминированный снимок INITIAL.
    return { ...a }
  })
}

export function usePrices(): PriceMap {
  // [Задача 2] Кэш QueryClient = общий «стор» цен: он переживает размонтирование, поэтому
  // возврат со страницы актива не сбрасывает данные и не показывает скелетон заново.
  const query = useQuery({
    queryKey: ['prices', 'all'],
    queryFn: fetchAllPrices,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnMount: false,
    // keepPreviousData-семантика: пока идёт первый фетч, отдаём снимок (или прежние
    // данные при ремаунте) вместо пустоты → нет вспышки isLoading.
    placeholderData: (prev) => prev ?? INITIAL,
  })

  const prices = query.data ?? INITIAL
  console.debug('[usePrices] widgets=%d isLoading=%s updatedAt=%d', prices.length, query.isLoading, query.dataUpdatedAt)

  const bySymbol: Record<string, Asset> = {}
  for (const a of prices) bySymbol[a.symbol] = a

  return {
    bySymbol,
    cryptos: prices.filter((a) => a.type === 'crypto'),
    stocks: prices.filter((a) => a.type === 'stock'),
    forex: prices.filter((a) => a.type === 'forex'),
    all: prices,
    isLoading: query.isLoading,
    lastUpdated: query.dataUpdatedAt,
  }
}
