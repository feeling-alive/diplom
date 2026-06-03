import { useQuery } from '@tanstack/react-query'
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

// One fetch cycle: pull live OKX spot tickers, backend-proxied forex rates and a
// handful of stock quotes, then merge them onto the static snapshot. Returns a
// fresh Asset[] (pure — no component state), which is what TanStack Query caches.
async function fetchAllPrices(): Promise<Asset[]> {
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

  return INITIAL.map((a) => {
    const u = updates.get(a.symbol)
    if (u) return { ...a, ...u }
    // [FIX Задача 3] Индексы (SPX/DJI/IXIC/DAX/NKY/USOIL/UKOIL) не имеют бесплатного
    // живого источника — Finnhub free их не отдаёт. Без этого guard'а к статичному
    // снимку применялся случайный jitter → SPX «дрожал». Оставляем снимок стабильным.
    if (a.type === 'index') return a
    // Лёгкий jitter относительно снимка, чтобы активы без живого источника не выглядели
    // полностью замершими. Считается от INITIAL (не накапливается) → значения стабильны.
    const j = 1 + (Math.random() - 0.5) * 0.01
    return { ...a, price: a.price * j }
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
    indices: prices.filter((a) => a.type === 'index'),
    all: prices,
    isLoading: query.isLoading,
    lastUpdated: query.dataUpdatedAt,
  }
}
