# Хуки проекта FinTrack

> Кастомные React-хуки в `src/hooks/`. Один файл = один источник данных.
> Общая конвенция: каждый хук работает без ключей API (через mock-fallback или `useMock`),
> логирует через `console.debug('[ИмяХука] ...')`, не бросает исключения в render.

---

## Сводная таблица

| Хук | Источник данных | Транспорт | Возвращает | Кэш / период |
|-----|-----------------|-----------|------------|--------------|
| `usePrices` | OKX + Frankfurter + Finnhub | fetch (polling) | `PriceMap` (все активы) | tick каждые 60с, jitter при ошибке |
| `useAssetPrice` | OKX WS / Finnhub / Frankfurter | WebSocket + fetch | `{price, change24h, isLoading, isConnected}` | realtime (крипта) / 60с (акции/форекс) |
| `useStockPrice` | Finnhub | fetch (polling) | `{price, change, isLoading}` | 60с |
| `useForexRate` | Frankfurter | fetch (one-shot) | `{rate, isLoading}` | по монтированию |
| `useOHLCV` | OKX candles | fetch (one-shot) | `{data: PricePoint[], isLoading, isConnected}` | по символу/таймфрейму |
| `useCoinInfo` | CoinGecko | TanStack Query | `CoinInfo \| null` | staleTime 30 мин, gcTime 60 мин |
| `useNews` | NewsAPI | TanStack Query | `NewsItem[]` | staleTime 15 мин, gcTime 30 мин |
| `useGroqChat` | Groq API | fetch (SSE stream) | `{messages, isStreaming, sendMessage, clearChat}` | — (стриминг) |
| `usePersonalized` | `usePrices` (производный) | — | `PersonalizedData` | `useMemo` |

---

## Детально по каждому хуку

### `usePrices()`
**Центральный хук цен.** Стартует с `data/prices.json` (снимок активов), каждые 60с делает
параллельные запросы и накладывает свежие данные поверх baseline.
- OKX SPOT tickers → цена + объём (крипта)
- Frankfurter `/latest?from=USD` → форекс-курсы (обе стороны пары)
- Finnhub `/quote` по 10 акциям (через `Promise.allSettled`)
- Если ответа нет — цена слегка джиттерит `±0.5%` (демо «живёт»).
- **Возвращает:** `{ bySymbol, cryptos, stocks, forex, indices, all, isLoading, lastUpdated }`.
- Чистит `setInterval` и флаг `mounted` в cleanup.

### `useAssetPrice(symbol, type, useMock?)`
**Цена одного актива на странице актива.** Ветвится по типу:
- `crypto` → **OKX WebSocket** (`tickers`), realtime, флаг `isConnected`.
- `stock` → Finnhub `/quote`, polling 60с.
- `forex` → Frankfurter `/latest`, polling 60с.
- Защита от не-finite значений change% (`Number.isFinite`), иначе `0`.
- **Возвращает:** `{ price, change24h, isLoading, isConnected }`.

### `useStockPrice(symbol, useMock?)`
Котировка акции через Finnhub, polling 60с. При `useMock` или отсутствии ключа — из `MOCK_PRICES`.
- **Возвращает:** `{ price, change, isLoading }`.

### `useForexRate(from, to, useMock?)`
Курс валютной пары через Frankfurter (один запрос при монтировании). Mock-fallback.
- **Возвращает:** `{ rate, isLoading }`.

### `useOHLCV(symbol, timeframe, useMock?)`
Свечные данные (OHLCV) для графиков. OKX candles REST; таймфрейм маппится в OKX-bar
(`1H/1Dutc/1Wutc/1Mutc`). При ошибке/`useMock` — `generateMockOHLCV`.
- **Возвращает:** `{ data: PricePoint[], isLoading, isConnected }`.

### `useCoinInfo(symbol)`
Метаданные монеты с CoinGecko через **TanStack Query** (описание, сайт, ранг, алгоритм, категории).
Символ маппится в coinId через `SYMBOL_TO_COIN_ID`. `staleTime 30мин`, `retry 1`.
- **Возвращает:** результат `useQuery<CoinInfo | null>`.

### `useNews(query?)`
Новостная лента через **TanStack Query** (NewsAPI). Без ключа — `MOCK_NEWS`.
`staleTime 15мин`, `retry 1`.
- **Возвращает:** результат `useQuery<NewsItem[]>`.

### `useGroqChat(contextLabel?)`
AI-чат через Groq API (`llama-3.3-70b-versatile`), **стриминг по SSE** (`ReadableStream` reader,
парсинг `data: ` чанков). Без ключа — сообщение-заглушка. `AbortController` для отмены.
- **Возвращает:** `{ messages, isStreaming, sendMessage, clearChat }`.

### `usePersonalized()`
**Производный хук** (не ходит в сеть) — поверх `usePrices()` через `useMemo`:
top-pick, watchlist (топ-5 по change), суммарная стоимость, средний дневной change.
- **Возвращает:** `{ topPick, watchlist, portfolioValue, dayChange }`.

---

## Слой окружения (`src/lib/env.ts`)

Все хуки читают ключи/URL через `ENV` (обёртка над `import.meta.env.VITE_*`):
`FINNHUB_API_KEY`, `FINNHUB_BASE_URL`, `FRANKFURTER_BASE_URL`, `NEWS_API_KEY`, `NEWS_API_BASE_URL`,
`GROQ_API_KEY`/`GROQ_BASE_URL`/`GROQ_MODEL`, `OKX_WS_URL`. Флаг `USE_MOCK` (`VITE_MOCK_MODE`).

## Связь с бэкендом

Новый сервис `backend/` (FastAPI + Redis) предоставляет кэширующие эндпоинты `/api/quotes/*`.
Хуки `usePrices` / `useStockPrice` / `useAssetPrice` (ветки stock/forex) / `useForexRate`
**пока на бэкенд не переведены** — план миграции в `backend/README.md`. OKX WebSocket
(`useAssetPrice` crypto) остаётся на клиенте.
