# FinTrack Dashboard — Step 2: Mock Data + Hooks

**Scope:** `src/mock/` data files · `src/hooks/` data-fetching hooks  
**Date:** 2026-05-13  
**Testing:** type-check via `tsc --noEmit`  
**Logging:** Verbose — every non-obvious decision commented  
**Redux:** Deferred — `usePersonalized` uses volume24h as viewCount proxy for now

---

## Settings

- Testing: `npx tsc --noEmit` — all new `.ts` files must pass clean
- Logging: verbose — comment any non-obvious logic in hooks
- Docs: warn-only
- No git repository — commit plan is advisory only

---

## Context

Step 1 complete:
- `src/types/market.types.ts` — all 6 types exported
- Design tokens in `src/index.css`
- `@tanstack/react-query`, `framer-motion`, `lucide-react` installed

Step 2 combines **ШАГ 2** (Hooks) + **ШАГ 3** (Mock Data) from the prompt because hooks import mock files — mock must exist first.

---

## Tasks

### Phase A — Mock Data (Tasks 1–4)

#### ~~Task 1 — Create `src/mock/prices.mock.ts`~~ ✅

**File:** `src/mock/prices.mock.ts` (create `src/mock/` directory)

Export `MOCK_PRICES: Asset[]` with exactly these 8 assets (values from prompt):

```typescript
import type { Asset } from '../types/market.types'

export const MOCK_PRICES: Asset[] = [
  {
    symbol: 'BTC-USDT', name: 'Bitcoin', type: 'crypto',
    price: 94320, change24h: 2.8, changeDollar: 2567.52,
    volume24h: 42_100_000_000, marketCap: 1_860_000_000_000,
    high24h: 95400, low24h: 91800, color: '#F7931A', icon: 'B',
  },
  {
    symbol: 'ETH-USDT', name: 'Ethereum', type: 'crypto',
    price: 3210, change24h: 1.4, changeDollar: 44.38,
    volume24h: 18_700_000_000, marketCap: 386_000_000_000,
    high24h: 3280, low24h: 3140, color: '#627EEA', icon: 'E',
  },
  {
    symbol: 'SOL-USDT', name: 'Solana', type: 'crypto',
    price: 178.50, change24h: 4.2, changeDollar: 7.18,
    volume24h: 8_300_000_000, marketCap: 82_000_000_000,
    high24h: 182, low24h: 172, color: '#9945FF', icon: 'S',
  },
  {
    symbol: 'AAPL', name: 'Apple', type: 'stock',
    price: 189.45, change24h: -0.6, changeDollar: -1.14,
    volume24h: 4_200_000_000, marketCap: 2_940_000_000_000,
    high24h: 191.2, low24h: 188.9, color: '#1A1A1A', icon: 'A',
  },
  {
    symbol: 'MSFT', name: 'Microsoft', type: 'stock',
    price: 415.20, change24h: 0.9, changeDollar: 3.72,
    volume24h: 3_100_000_000, marketCap: 3_080_000_000_000,
    high24h: 417.5, low24h: 412.8, color: '#00A4EF', icon: 'M',
  },
  {
    symbol: 'EUR-USD', name: 'Euro / US Dollar', type: 'forex',
    price: 1.08420, change24h: 0.3, changeDollar: 0.00325,
    volume24h: 89_300_000_000,
    high24h: 1.0870, low24h: 1.0808, color: '#003399', icon: '€',
  },
  {
    symbol: 'GBP-USD', name: 'British Pound / US Dollar', type: 'forex',
    price: 1.26540, change24h: -0.2, changeDollar: -0.00253,
    volume24h: 45_100_000_000,
    high24h: 1.2690, low24h: 1.2630, color: '#C8102E', icon: '£',
  },
  {
    symbol: 'SPX', name: 'S&P 500', type: 'index',
    price: 5842.30, change24h: 0.8, changeDollar: 46.34,
    volume24h: 12_400_000_000,
    high24h: 5860, low24h: 5820, color: '#2E4057', icon: 'S',
  },
]
```

**Logging:** none needed — data file is self-evident.  
**Verify:** `tsc --noEmit` — no errors.

---

#### ~~Task 2 — Create `src/mock/news.mock.ts`~~ ✅

**File:** `src/mock/news.mock.ts`

Export `MOCK_NEWS: NewsItem[]` — 10 items in Russian (4 crypto, 3 stock, 2 forex, 1 macro).

Headlines:
1. (positive, crypto) "Bitcoin преодолел $94,000 на фоне институционального спроса" — relatedAssets: ['BTC-USDT']
2. (positive, crypto) "Ethereum готовится к обновлению: объём DEX вырос на 23%" — relatedAssets: ['ETH-USDT']
3. (positive, crypto) "Solana обрабатывает рекордные 65,000 TPS: экосистема растёт" — relatedAssets: ['SOL-USDT']
4. (neutral, crypto) "Криптобиржи ужесточают KYC-проверки в ответ на требования регуляторов" — relatedAssets: ['BTC-USDT', 'ETH-USDT']
5. (positive, stock) "Apple отчёт Q4: выручка превысила прогнозы аналитиков на 4%" — relatedAssets: ['AAPL']
6. (positive, stock) "Microsoft Azure показывает рост 29% г/г: акции обновляют максимум" — relatedAssets: ['MSFT']
7. (neutral, stock) "S&P 500 закрылся в плюсе: инвесторы ждут данных по инфляции" — relatedAssets: ['SPX']
8. (neutral, forex) "Инфляция в США снизилась до 2.4%: форекс волатильность растёт" — relatedAssets: ['EUR-USD', 'GBP-USD']
9. (negative, forex) "Банк Англии оставляет ставку без изменений: фунт под давлением" — relatedAssets: ['GBP-USD']
10. (neutral, macro) "ФРС сохраняет ставку: рынки реагируют умеренным ростом" — relatedAssets: ['SPX', 'EUR-USD']

All `imageUrl` fields omitted (optional). `publishedAt` values: ISO strings relative to 2026-05-13.  
`url` fields: `'#'` (mock, no real links).

**Logging:** none needed.

---

#### ~~Task 3 — Create `src/mock/community.mock.ts`~~ ✅

**File:** `src/mock/community.mock.ts`

Export `MOCK_COMMUNITY: CommunityPost[]` — 8 posts from 5 authors:

Authors:
- alex_btc → initials "AB", avatarColor "#F7931A" — 2 posts about BTC
- eth_trader → initials "ET", avatarColor "#627EEA" — 2 posts about ETH
- stock_pro → initials "SP", avatarColor "#1A1A1A" — 2 posts about AAPL/MSFT
- fx_master → initials "FM", avatarColor "#003399" — 1 post about EUR-USD
- crypto_anna → initials "CA", avatarColor "#9945FF" — 1 post about SOL

Each post includes: id, author, content (50–120 chars), relatedAsset, assetColor, likes, comments, createdAt, isLiked: false.

Example post (from prompt):
```typescript
{
  author: { name: 'Алекс Б.', handle: 'alex_btc', initials: 'AB', avatarColor: '#F7931A' },
  content: 'BTC формирует бычий флаг на 4H таймфрейме. Жду пробоя $95,400 для входа в лонг...',
  relatedAsset: 'BTC', assetColor: '#F7931A', likes: 42, comments: 8,
}
```

---

#### ~~Task 4 — Create `src/mock/ohlcv.mock.ts`~~ ✅

**File:** `src/mock/ohlcv.mock.ts`

Export `getMockOHLCV(symbol: string, count = 100): PricePoint[]`

Logic:
- Find base price from `MOCK_PRICES` (default 100 if not found)
- Generate `count` candles going backwards from `Date.now()` at 1-hour intervals
- Random walk: each candle varies ±1.5% from previous close
- Construct OHLCV: open = prev close, close = open ± random, high = max(open, close) + small, low = min(open, close) - small, volume = random(50M–500M)

```typescript
import type { PricePoint } from '../types/market.types'
import { MOCK_PRICES } from './prices.mock'

export function getMockOHLCV(symbol: string, count = 100): PricePoint[] { ... }
```

**Logging:** none — pure data generation.

---

### Phase B — Hooks (Tasks 5–8)

#### ~~Task 5 — Create `src/hooks/useAssetPrice.ts`~~ ✅

**File:** `src/hooks/useAssetPrice.ts`

```typescript
useAssetPrice(symbol: string, type: Asset['type'], useMock = true)
→ { price: number, change24h: number, isLoading: boolean, isConnected: boolean }
```

**Mock path** (`useMock = true`):
- Find asset in `MOCK_PRICES` by symbol
- Return immediately with `isLoading: false, isConnected: false`
- If not found: return zeros with `isLoading: false`

**Real path** (`useMock = false`) — structure only, marked with `// TODO: real impl`:
- `type === 'crypto'`: open WebSocket `wss://ws.okx.com:8443/ws/v5/public`, subscribe to `{ channel: 'tickers', instId: symbol }`, parse `data[0].last` and `data[0].changeRate24h`. `isConnected: true` once connected.
- `type === 'stock'`: `useEffect` with `setInterval(30_000)`, fetch `https://finnhub.io/api/v1/quote?symbol={symbol}&token={import.meta.env.VITE_FINNHUB_KEY}`, map `c` → price, `dp` → change24h
- `type === 'forex'`: `setInterval(60_000)`, fetch `https://api.frankfurter.app/latest?from={base}&to={quote}`, map rate to price

**Cleanup:** return cleanup function from useEffect that closes WebSocket / clears interval.

**Logging (verbose):** `console.debug('[useAssetPrice]', symbol, 'mock=', useMock, 'price=', price)` on value change.

---

#### ~~Task 6 — Create `src/hooks/useOHLCV.ts`~~ ✅

**File:** `src/hooks/useOHLCV.ts`

```typescript
useOHLCV(symbol: string, timeframe: Timeframe, useMock = true)
→ { data: PricePoint[], isLoading: boolean, error: Error | null }
```

**Uses React Query:**
```typescript
import { useQuery } from '@tanstack/react-query'

const { data, isLoading, error } = useQuery({
  queryKey: ['ohlcv', symbol, timeframe, useMock],
  queryFn: () => useMock ? getMockOHLCV(symbol) : fetchRealOHLCV(symbol, timeframe),
  staleTime: 5 * 60 * 1000,
  refetchInterval: 60 * 1000,
})
```

**Real fetch stubs** (`useMock = false`, marked `// TODO`):
- Crypto: `GET https://www.okx.com/api/v5/market/candles?instId={symbol}&bar={timeframe}&limit=100` → map array format to PricePoint
- Stock: `GET https://finnhub.io/api/v1/stock/candle?...` → map to PricePoint

**Logging:** `console.debug('[useOHLCV]', symbol, timeframe, 'points=', data?.length)`.

---

#### ~~Task 7 — Create `src/hooks/useStockPrice.ts`, `useForexRate.ts`, `useNews.ts`~~ ✅

**useStockPrice.ts:**
```typescript
useStockPrice(symbol: string, useMock = true)
→ { price: number, change: number, isLoading: boolean }
```
Mock: lookup in MOCK_PRICES where `type === 'stock'`.  
Real: `// TODO: GET https://finnhub.io/api/v1/quote`

**useForexRate.ts:**
```typescript
useForexRate(from: string, to: string, useMock = true)
→ { rate: number, isLoading: boolean }
```
Mock: construct symbol `${from}-${to}` and find in MOCK_PRICES where `type === 'forex'`. Return `price` as `rate`.  
Real: `// TODO: GET https://api.frankfurter.app/latest?from={from}&to={to}`

**useNews.ts:**
```typescript
useNews(relatedAsset?: string, useMock = true)
→ { news: NewsItem[], isLoading: boolean, error: Error | null }
```
Mock: filter `MOCK_NEWS` by `relatedAssets.includes(relatedAsset)` when `relatedAsset` is provided; return all otherwise.  
Real: `// TODO: GET NewsAPI with query={relatedAsset ?? 'finance'}`

**Logging (all three):** `console.debug('[useXxx]', params, 'result count=', ...)` on mount.

---

#### ~~Task 8 — Create `src/hooks/usePersonalized.ts`~~ ✅

**File:** `src/hooks/usePersonalized.ts`

```typescript
usePersonalized(useMock = true)
→ { topAssets: Asset[], isLoading: boolean }
```

Mock: sort `MOCK_PRICES` by `volume24h` descending, return top 5. (Redux/viewCount integration deferred — will replace this when Redux Toolkit step is added.)  
Real: `// TODO: GET /api/user/personalized`

**Logging:** `console.debug('[usePersonalized] topAssets=', topAssets.map(a => a.symbol))`.

---

### Phase C — Verification (Task 9)

#### ~~Task 9 — Type-check Step 2~~ ✅

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v "\.jsx" | grep -v "\.js" | grep "error" || echo "No TS errors in .ts/.tsx files"
```

All files in `src/mock/**/*.ts` and `src/hooks/**/*.ts` must produce zero errors.

Common issues to watch for:
- `MOCK_PRICES` import path from hooks (use `'../mock/prices.mock'`)
- `getMockOHLCV` return type matching `PricePoint[]`
- `useQuery` generic type parameter: `useQuery<PricePoint[]>(...)`

---

## Commit Plan (Advisory — no git)

**Checkpoint 1** after Tasks 1–4 (mock data complete):
```
feat: add mock data — prices, news, community, OHLCV
```

**Checkpoint 2** after Tasks 5–8 (all hooks):
```
feat: add data-fetching hooks — useAssetPrice, useOHLCV, useStockPrice, useForexRate, useNews, usePersonalized
```

**Checkpoint 3** after Task 9 (verified):
```
chore: verify Step 2 type-check passes
```

---

## Next Step

After this step is verified, run `/aif-plan` again for **Step 3: Components** (`src/components/dashboard/`).

Components to build (from the prompt):
- `FloatingAssetCards.tsx` — floating animated asset cards
- `PortfolioHero.tsx` — portfolio value hero with count-up animation
- `KpiStrip.tsx` — 5 KPI cards grid
- `AssetStrip.tsx` — horizontal scrollable asset row
- `WatchlistPanel.tsx`, `AllocationChart.tsx`, `PersonalizedPanel.tsx` — three-column section
- `PriceChartWidget.tsx` — SVG area chart (check 21dev first)
- `CommunityWidget.tsx` — community posts
- `NewsWidget.tsx` — news with sentiment filters
- `AddWidgetModal.tsx` — widget management modal
