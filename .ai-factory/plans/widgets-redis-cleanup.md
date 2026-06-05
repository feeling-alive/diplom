# Implementation Plan: Widget Cleanup + AssetPage Redis Integration

Branch: none (`git.create_branches=false`, full mode без ветки)
Created: 2026-06-05
Slug: `widgets-redis-cleanup`

## Settings
- Testing: yes (Vitest для фронта + pytest для бэка)
- Logging: verbose (`console.debug/info/warn` с префиксом `[ComponentName]`)
- Docs: yes (обязательный чекпоинт `/aif-docs` в конце)

## Roadmap Linkage
- Milestone: none (`.ai-factory/ROADMAP.md` отсутствует, linkage пропущен)

## Контекст

**Предыдущий план** (`.ai-factory/REPORT.md`, июнь 2026) реализовал 20 виджет-фиксов и подключил реальные данные в 19 виджетах. После него в реестре осталось 10 виджетов на хардкодах + 2 частично рабочих (`market_volume` синтетический sparkline, `kpi_strip` на MOCK_PRICES) + 2 hero-компонента с зашитыми числами (`PortfolioHero`, `AssetStrip` частично).

**Текущая задача — 4 параллельных трека:**

1. **Cleanup**: убрать из реестра 5 виджетов (AI Signal, Yield Curve, Price Alerts, Economic Calendar, P&L Portfolio) — они либо избыточны, либо заменены лучшими альтернативами, либо работают только с браузерными API без CORS-обхода.
2. **Backend Redis**: добавить 5 эндпоинтов под `/api/quotes/*` (ohlcv, coin, fng, funding-rate, gas) с Redis-кешем и graceful degradation.
3. **AssetPage миграция на бэкенд**: `useOHLCV`, `useCoinInfo`, `usePrices.crypto-batch`, `FearGreedWidget` → backend; убрать хардкод `useMock=true` в `AssetHeader` и `SimpleChart`.
4. **Real data для 10 оставшихся виджетов** + 2 hero-компонентов.

**Доп. фиксы:** Y-ось Recharts с валютой актива, кнопки 1m/5m/15m, TradingView exchange mapping (не только BINANCE).

## Зависимости

```
Phase 1 (cleanup)
  └─> Phase 2 (backend endpoints)
       └─> Phase 3 (frontend migration)
            └─> Phase 4 (remaining widgets)
                 └─> Phase 5 (chart fixes)
                      └─> Phase 6 (tests)
                           └─> Phase 7 (docs)
```

Phase 1 можно делать параллельно с Phase 2. Phase 3-5 — последовательно (одна фича = один поток изменений). Phase 6-7 — в конце.

## Tasks

### Phase 1: Реестр — удаление 5 виджетов

- [ ] Task 1.1: Удалить `ai_signal`, `yield_curve`, `price_alerts`, `economic_calendar`, `portfolio_pnl` из реестра
  - Файлы:
    - `frontend/src/types/widgets.types.ts` — удалить 5 значений из `WidgetType` union (строки 3-34)
    - `frontend/src/constants/widgets.registry.ts` — удалить 5 entries
    - `frontend/src/components/dashboard/WidgetCard.tsx` — удалить 5 case-веток в `renderWidgetContent` (строки 37-72)
    - `frontend/src/pages/AddWidgetModal.tsx` (если есть маппинг) — убрать из списка доступных
  - Дополнительно: удалить осиротевшие файлы `AiSignalWidget.tsx`, `YieldCurveWidget.tsx`, `PriceAlertsWidget.tsx`, `EconomicCalendarWidget.tsx`, `PortfolioPnlWidget.tsx` (но НЕ делать жёсткий `rm` — оставить до Phase 1.2 для безопасности; `WidgetCard` их не вызовет, и они не попадут в bundle через tree-shaking)
  - Логирование: `console.debug('[registry] removed widget %s', type)` для каждого удаления

- [ ] Task 1.2: Бамп версии localStorage + миграция stale keys
  - Файл: `frontend/src/lib/dashboardLayout.ts`
  - Действия:
    - Переименовать `ENVELOPE_KEY` с `fintrack_dashboards_v1` на `fintrack_dashboards_v2` (новая схема реестра)
    - В `loadLocalEnvelope()` добавить проверку: если в сохранённом envelope есть виджеты с `type ∈ {ai_signal, yield_curve, price_alerts, economic_calendar, portfolio_pnl}` — выбросить их с `console.info('[dashboardLayout] purging removed widget from layout: %s', type)`
    - Старый ключ `fintrack_dashboards_v1` добавить в `LEGACY_STORAGE_KEYS` (или не удалять сразу — пусть лежит для пользователей, которые зайдут со старой версией)
  - Логирование: `console.info('[dashboardLayout] purging legacy localStorage key %s', key)` для каждого старого ключа при чтении

### Phase 2: Backend новые эндпоинты (Redis-кеш)

Бэкенд уже запущен (PID, health=ok). Все новые эндпоинты добавляются как `services/` + роуты под `/api/quotes/*`. Redis уже настроен (`backend/app/cache.py` с TTL и graceful degradation).

- [ ] Task 2.1: `GET /api/quotes/ohlcv/{symbol}?tf=1H&limit=100`
  - Файлы: `backend/app/services/candles.py` (новый), `backend/app/routes/quotes.py` (расширить)
  - Логика: прокси к `https://www.okx.com/api/v5/market/candles?instId={SYMBOL}&bar={TF}&limit={LIMIT}` для крипто; для стоков — `https://finnhub.io/api/v1/stock/candle?symbol={SYM}&resolution={TF}&from=&to=&token={FINNHUB_KEY}` (ключ только на бэке)
  - Redis: ключ `cache:ohlcv:{SYMBOL}:{TF}:{LIMIT}`, TTL **60s** для крипто, **5min** для стоков (финхуб лимиты строже)
  - Response: `{symbol, timeframe, candles: [{t, o, h, l, c, v}], source: 'okx'|'finnhub'|'cache'}`
  - Ошибки: Finnhub 429 → fallback на mock из `backend/app/mock/candles.json`; OKX network error → 503 + пустой массив
  - Логирование: `console.info('[ohlcv] cache hit %s %s', symbol, tf)` / `'[ohlcv] fetched %d candles from %s', len, source`

- [ ] Task 2.2: `GET /api/quotes/coin/{id}`
  - Файлы: `backend/app/services/coingecko.py` (новый), `backend/app/routes/quotes.py` (расширить)
  - Логика: прокси к `https://api.coingecko.com/api/v3/coins/{id}?localization=false&tickers=false&community_data=false&developer_data=false`
  - Redis: ключ `cache:coin:{ID}`, TTL **30 мин** (статичные данные, лимиты CoinGecko)
  - Response: `{id, symbol, name, description: {en, ru}, market_data: {current_price, market_cap, total_volume, ...}, image: {large, small}}`
  - Ошибки: 429 → fallback на `backend/app/mock/coin.json` (1-2 мок-монеты для dev)
  - Логирование: `console.info('[coin] cache hit / fetched %s', id)`

- [ ] Task 2.3: `GET /api/quotes/fng`
  - Файлы: `backend/app/services/fng.py` (новый), `backend/app/routes/quotes.py` (расширить)
  - Логика: прокси к `https://api.alternative.me/fng/?limit=1&format=json`
  - Redis: ключ `cache:fng`, TTL **1 час**
  - Response: `{value, label, timestamp, fetchedAt}`
  - Ошибки: network → fallback `{value: 50, label: 'Neutral', timestamp: now}`
  - Логирование: `console.info('[fng] cache hit / fetched value=%d', value)`

- [ ] Task 2.4: `GET /api/quotes/funding-rate?symbols=BTC-USDT,ETH-USDT`
  - Файлы: `backend/app/services/funding.py` (новый), `backend/app/routes/quotes.py` (расширить)
  - Логика: для каждого символа — `https://www.okx.com/api/v5/public/funding-rate?instId={SYMBOL}`; батч с `Promise.all`
  - Redis: ключ `cache:funding:{SYMBOL}`, TTL **30s** (фандинг меняется каждые 8ч, но обновление раз в 30s для демо — норм)
  - Response: `{rates: [{symbol, fundingRate, nextFundingTime, interestRate, ...}]}`
  - Логирование: `console.info('[funding] fetched %d rates', rates.length)`

- [ ] Task 2.5: `GET /api/quotes/gas`
  - Файлы: `backend/app/services/gas.py` (новый), `backend/app/routes/quotes.py` (расширить)
  - Логика: прокси к `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey={ETHERSCAN_KEY}` (ключ — `ETHERSCAN_API_KEY` в env бэка)
  - Redis: ключ `cache:gas`, TTL **15s** (газ меняется быстро)
  - Response: `{slow: {gwei, usd}, standard: {gwei, usd}, fast: {gwei, usd}, baseFee: gwei, lastBlock}`
  - Ошибки: 429 / quota exceeded → fallback `{slow: 18, standard: 24, fast: 32, baseFee: 20}` с флагом `isStale: true`
  - Логирование: `console.info('[gas] cache hit / fetched slow=%d std=%d fast=%d', ...)`
  - Задача: `ETHERSCAN_API_KEY` нужно добавить в `backend/.env.example` (env.bak документация) — если ключа нет, эндпоинт сразу отдаёт fallback с пометкой

- [ ] Task 2.6: Бэкенд-тесты для 5 новых эндпоинтов
  - Файл: `backend/tests/test_quotes_new.py` (новый)
  - Кейсы: cache hit на 2-й запрос, mock fallback при недоступном upstream, response schema, batch funding-rate, TTL
  - Моки: `httpx` AsyncClient + `aioresponses` (если уже в deps) или `unittest.mock.patch` на httpx

### Phase 3: Frontend миграция на бэкенд (AssetPage + хуки)

- [ ] Task 3.1: `useOHLCV` → backend
  - Файл: `frontend/src/hooks/useOHLCV.ts`
  - Действия: убрать прямые fetch'и к OKX/Finnhub; новый путь — `/api/quotes/ohlcv/{SYMBOL}?tf={TF}&limit=100` через vite-proxy
  - Маппинг `Timeframe → OKX bar`: `1m→1m, 5m→5m, 15m→15m, 1H→1H, 4H→4H, 1D→1D, 1W→1W, 1M→1M`
  - Маппинг символов: BTC → `BTC-USDT`, AAPL → `AAPL` (Finnhub path)
  - Сохранить `useMock?: boolean = true` параметр, fallback на `getMockOHLCV` из `mock/ohlcv.mock.ts`
  - Логирование: `console.debug('[useOHLCV] fetch %s %s -> %d candles', symbol, tf, len)`

- [ ] Task 3.2: `useCoinInfo` → backend
  - Файл: `frontend/src/hooks/useCoinInfo.ts`
  - Действия: убрать прямой fetch к `api.coingecko.com`; новый путь — `/api/quotes/coin/{ID}` (ID маппится через `SYMBOL_TO_COIN_ID` из `constants/`)
  - TanStack Query: ключ `['coin', id]`, `staleTime: 30min` (соответствует backend TTL)
  - Сохранить fallback на `MOCK_COIN_INFO`
  - Логирование: `console.debug('[useCoinInfo] fetch %s -> %o', id, data)`

- [ ] Task 3.3: `FearGreedWidget` → backend
  - Файл: `frontend/src/components/dashboard/widgets/FearGreedWidget.tsx`
  - Действия: убрать прямой fetch к `api.alternative.me`; новый путь — `/api/quotes/fng` через vite-proxy
  - Сохранить localStorage-кеш `fintrack_fng_cache_v2` (бамп суффикса из-за смены источника)
  - Логирование: `console.info('[FearGreedWidget] cache hit / fetched value=%d', value)`

- [ ] Task 3.4: Убрать хардкод `useMock=true` в `AssetHeader` и `SimpleChart`
  - Файлы: `frontend/src/components/asset/AssetHeader.tsx:15`, `frontend/src/components/asset/SimpleChart.tsx:67`
  - Действия: заменить `useAssetPrice(symbol, type, true)` на `useAssetPrice(symbol, type)` (полагаемся на `USE_MOCK` env); то же для `useOHLCV`
  - Дополнительно: если `VITE_MOCK_MODE !== 'true'` (по умолчанию), данные берутся с бэкенда
  - Логирование: `console.debug('[AssetHeader] / [SimpleChart] useMock=%s (env)', USE_MOCK)`

- [ ] Task 3.5: Vite-proxy для новых эндпоинтов (если нужен path rewrite)
  - Файл: `frontend/vite.config.ts`
  - Действия: проверить, что `/api/quotes/*` проксируется на `http://localhost:8000` (он уже там по рекону). Если нет — добавить. Path rewrite не требуется (структура путей одинаковая)

- [ ] Task 3.6: `env.ts` — вычистить `VITE_FINNHUB_API_KEY`
  - Файл: `frontend/src/lib/env.ts`
  - Действия: пометить `FINNHUB_API_KEY` как deprecated (`/** @deprecated перенесён в backend/.env */`); добавить warning в `console.warn` при доступе
  - Логирование: `console.warn('[env] VITE_FINNHUB_API_KEY is deprecated, moved to backend/.env')` если кто-то пытается читать

### Phase 4: Real data для 10 оставшихся виджетов + 2 hero-компонентов

- [ ] Task 4.1: `CorrelationMatrixWidget` — Pearson на closes
  - Файл: `frontend/src/components/dashboard/widgets/CorrelationMatrixWidget.tsx`
  - Действия: заменить хардкод `MATRIX` на расчёт Pearson correlation между `useOHLCV(symbol, '1D').data.map(d => d.close)` для 5 пар (BTC/ETH/SOL/BNB/XRP)
  - Чистая client-side функция: `pearson(xs: number[], ys: number[]): number`
  - Переключатель периода: 7d / 30d / 90d (limit=7/30/90)
  - Логирование: `console.debug('[CorrelationMatrixWidget] gridW=%d computed %dx%d matrix', gridW, N, N)`

- [ ] Task 4.2: `CurrencyConverterWidget` — multi-pair через `useForexRate`
  - Файл: `frontend/src/components/dashboard/widgets/CurrencyConverterWidget.tsx`
  - Действия: убрать `RATE_USD_RUB = 92.4`; новый путь — `useForexRate(from, to)` из `frontend/src/hooks/useForexRate.ts` (он уже идёт на backend `/api/quotes/forex/{from}/{to}`)
  - UI: select `from` (USD/EUR/GBP/RUB/JPY), input amount, показ `≈ X.YY {to}` + обратный курс
  - Логирование: `console.debug('[CurrencyConverterWidget] %s -> %s rate=%f', from, to, rate)`

- [ ] Task 4.3: `FundingRateWidget` — backend `/api/quotes/funding-rate`
  - Файл: `frontend/src/components/dashboard/widgets/FundingRateWidget.tsx`
  - Действия: заменить хардкод `ROWS` на fetch к `/api/quotes/funding-rate?symbols=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT,DOGE-USDT,BNB-USDT`
  - Refresh: polling 60s (как backend TTL — 30s; ставим 60s чтобы видеть апдейты вручную)
  - Цвет: зелёный если rate ≥ 0, красный если < 0
  - Логирование: `console.debug('[FundingRateWidget] fetched %d rates', rates.length)`

- [ ] Task 4.4: `StockScreenerWidget` — Finnhub + `useStockPrice`
  - Файл: `frontend/src/components/dashboard/widgets/StockScreenerWidget.tsx`
  - Действия: заменить хардкод `ROWS` на fetch `/api/quotes/stocks?symbols=AAPL,MSFT,NVDA,TSLA,GOOG,AMZN` (backend уже умеет batch, см. `routes/quotes.py:GET /stocks`)
  - Сортировка: по `changePercent desc` (топ-гайнеры) или `changePercent asc` (топ-лузеры); переключатель
  - Логирование: `console.debug('[StockScreenerWidget] sort=%s rows=%d', sort, rows.length)`

- [ ] Task 4.5: `GasTrackerWidget` — backend `/api/quotes/gas`
  - Файл: `frontend/src/components/dashboard/widgets/GasTrackerWidget.tsx`
  - Действия: заменить хардкод `TIERS` на fetch `/api/quotes/gas`
  - Refresh: 30s
  - Показ: 3 яруса (Slow/Standard/Fast) с gwei + USD estimate (на типичный gasUsed=21000)
  - Логирование: `console.debug('[GasTrackerWidget] slow=%d std=%d fast=%d baseFee=%d', ...)`

- [ ] Task 4.6: `SentimentMeterWidget` — derived from FNG
  - Файл: `frontend/src/components/dashboard/widgets/SentimentMeterWidget.tsx`
  - Действия: убрать `score = 62`; новый путь — общий hook `useFearGreed()` (вынести логику из `FearGreedWidget` в `frontend/src/hooks/useFearGreed.ts`, переиспользовать в обоих виджетах)
  - Показ: 0-100 gauge + label + дата
  - Логирование: `console.debug('[SentimentMeterWidget] score=%d label=%s', value, label)`

- [ ] Task 4.7: `MarketVolumeWidget` — заменить синтетический sparkline
  - Файл: `frontend/src/components/dashboard/widgets/MarketVolumeWidget.tsx`
  - Действия: убрать `SPARK_DATA` sine wave; новый путь — `useOHLCV('BTC', '1D', false)` → `data.map(d => d.volume)`, отрисовать Recharts `<Line>` sparkline
  - При отсутствии данных — fallback на пустой sparkline
  - Логирование: `console.debug('[MarketVolumeWidget] sparkline points=%d', points.length)`

- [ ] Task 4.8: `WhaleTrackerWidget` — keep mock с badge "Demo data"
  - Файл: `frontend/src/components/dashboard/widgets/WhaleTrackerWidget.tsx`
  - Действия: добавить pill-бейдж «Demo» в углу виджета (без замены данных — нет публичного free API); убрать вводящий в заблуждение вид «live»
  - Альтернатива: `console.info('[WhaleTrackerWidget] using demo data — no free public whale-alert API')` при монтировании
  - Логирование: `console.info('[WhaleTrackerWidget] demo data (no public API)')`

- [ ] Task 4.9: `LiquidationsWidget` — keep mock с badge + ticker
  - Файл: `frontend/src/components/dashboard/widgets/LiquidationsWidget.tsx`
  - Действия: добавить badge «Demo»; заменить `Math.random()` в `genBars()` на детерминированный seed (`mulberry32(symbol)`) чтобы хотя бы не было flicker при ре-рендере
  - Логирование: `console.info('[LiquidationsWidget] demo data (no public free API)')`

- [ ] Task 4.10: `KpiStrip` — derive from `fintrack_holdings_v1` + `usePrices`
  - Файл: `frontend/src/components/dashboard/KpiStrip.tsx`
  - Действия: убрать `MOCK_PRICES.slice(0,4)`; новый путь — прочитать `fintrack_holdings_v1` (как в `PortfolioPnlWidget`), посчитать total value / 24h change / best position / worst position
  - Если holdings пуст — empty state "Добавьте активы"
  - Логирование: `console.debug('[KpiStrip] total=%.2f change=%.2f%%', totalPrice, changePercent)`

- [ ] Task 4.11: `PortfolioHero` — derive from holdings
  - Файл: `frontend/src/components/dashboard/PortfolioHero.tsx`
  - Действия: убрать `TARGET_VALUE = 528976.82`, `PREV_VALUE`, `CHANGE_PERCENT = 7.9`; новый путь — те же holdings + `usePrices()` (count-up анимация остаётся)
  - Если holdings пуст — статичная "Добавьте активы" секция
  - Логирование: `console.debug('[PortfolioHero] countUp target=%.2f', targetValue)`

### Phase 5: AssetPage chart fixes

- [ ] Task 5.1: Y-ось с валютой актива
  - Файл: `frontend/src/components/asset/SimpleChart.tsx`
  - Действия: заменить хардкод `tickFormatter: $` на `formatPrice(value, assetType)` из `utils/format.ts` — `type='crypto' → $`, `type='stock' → $`, `type='forex' → {base}/{quote}`, `type='index' → ''`
  - Логирование: `console.debug('[SimpleChart] Y axis formatter=%s (type=%s)', formatter, type)`

- [ ] Task 5.2: Кнопки таймфреймов 1m / 5m / 15m
  - Файл: `frontend/src/components/asset/SimpleChart.tsx`
  - Действия: расширить массив кнопок: `['1m','5m','15m','1H','4H','1D','1W','1M']`; на узких виджетах — прокручиваемая лента
  - Логирование: `console.debug('[SimpleChart] timeframe=%s points=%d', tf, points.length)`

- [ ] Task 5.3: TradingView exchange mapping
  - Файл: `frontend/src/components/asset/TradingViewModal.tsx`
  - Действия: убрать хардкод `BINANCE:` для всех крипто; маппинг:
    - BTC/ETH/SOL/XRP/DOGE/ADA/BNB/MATIC → `BINANCE:`
    - Стейблы (USDT/USDC/BUSD) → `BINANCE:`
    - Если монета не на Binance — fallback на `KUCOIN:` или `BYBIT:`
  - Логирование: `console.debug('[TradingViewModal] %s → %s%s', symbol, exchange, ticker)`

### Phase 6: Тесты

- [ ] Task 6.1: Vitest для новых/изменённых фронт-виджетов
  - Файлы: `frontend/src/components/dashboard/widgets/__tests__/CorrelationMatrixWidget.test.tsx`, `CurrencyConverterWidget.test.tsx`, `FundingRateWidget.test.tsx`, `StockScreenerWidget.test.tsx`, `GasTrackerWidget.test.tsx`, `SentimentMeterWidget.test.tsx`, `MarketVolumeWidget.test.tsx`, `WhaleTrackerWidget.test.tsx`, `LiquidationsWidget.test.tsx`, `KpiStrip.test.tsx`, `PortfolioHero.test.tsx`
  - Паттерн: jest-dom + mock framer-motion + mock useNavigate + mock хуки (useOHLCV/usePrices/useForexRate/useFearGreed) детерминированными фикстурами
  - Кейсы: mount + smoke, switcher click, empty state, loading state

- [ ] Task 6.2: Vitest для удалённых виджетов (negative test)
  - Файл: `frontend/src/constants/widgets.registry.test.ts` (новый)
  - Кейсы: `WIDGET_REGISTRY` не содержит `ai_signal`, `yield_curve`, `price_alerts`, `economic_calendar`, `portfolio_pnl`; `WidgetType` union тоже
  - Логирование: `console.debug` (если найдено — fail)

- [ ] Task 6.3: Vitest для `useOHLCV` против нового бэкенда
  - Файл: `frontend/src/hooks/__tests__/useOHLCV.test.ts` (новый или расширить существующий)
  - Моки: `global.fetch` возвращает фейковый `/api/quotes/ohlcv/...` ответ
  - Кейсы: success, fallback на mock при ошибке, cache hit через localStorage (если применимо)

- [ ] Task 6.4: Vitest для `useCoinInfo`
  - Файл: `frontend/src/hooks/__tests__/useCoinInfo.test.ts` (новый)
  - Кейсы: success с TanStack Query, fallback на mock, stale-while-revalidate

- [ ] Task 6.5: Backend pytest для 5 новых эндпоинтов
  - Файл: `backend/tests/test_quotes_new.py` (создан в Task 2.6)
  - Кейсы:
    - `/api/quotes/ohlcv/BTC-USDT?tf=1H&limit=100` — response schema, Redis cache hit на 2-й запрос
    - `/api/quotes/coin/bitcoin` — schema, fallback на mock при недоступности CoinGecko
    - `/api/quotes/fng` — schema, кеш
    - `/api/quotes/funding-rate` — batch, schema
    - `/api/quotes/gas` — schema, fallback при отсутствии ETHERSCAN_API_KEY
  - Паттерн: AsyncClient + mock httpx + `redis.asyncio` с in-memory fake или monkeypatch

### Phase 7: Документация (обязательный чекпоинт)

- [ ] Task 7.1: Обновить `docs/widgets.md` (или создать если нет)
  - Действия:
    - Удалить секции для: `ai_signal`, `yield_curve`, `price_alerts`, `economic_calendar`, `portfolio_pnl`
    - Добавить секции для: `correlation_matrix` (с формулой Pearson), `currency_converter`, `funding_rate`, `stock_screener`, `gas_tracker`, `sentiment_meter`, `market_volume` (sparkline), `whale_tracker` (Demo badge), `liquidations` (Demo badge), `kpi_strip` (holdings-based), `portfolio_hero` (holdings-based)
    - Зафиксировать новый счётчик виджетов: «26 зарегистрированных» (было 31)
  - Логирование: не требуется

- [ ] Task 7.2: Обновить `AGENTS.md`
  - Файлы: `AGENTS.md`, `.ai-factory/DESCRIPTION.md`
  - Действия:
    - В `AGENTS.md` — обновить таблицу бэкенд-эндпоинтов (`/api/quotes/*`): добавить 5 новых (`ohlcv`, `coin`, `fng`, `funding-rate`, `gas`)
    - Снять пометку «Additive» с `/api/quotes` (миграция завершена)
    - Зафиксировать `env.ts` изменение: `VITE_FINNHUB_API_KEY` deprecated
    - В `DESCRIPTION.md` — обновить «Источники данных в реальном времени» (добавить CoinGecko-proxy и funding-rate/gas)
  - Логирование: не требуется

- [ ] Task 7.3: Запустить `/aif-docs` чекпоинт
  - Действия: вызвать `/aif-docs` с указанием обновить `docs/widgets.md` (документ выше)
  - Логирование: не требуется

## Commit Plan

7 чекпоинтов (каждые 3-5 задач):

1. **`chore(dashboard): remove 5 unused widgets from registry + bump storage version`**
   - Phase 1 (Task 1.1, 1.2)
   - Conventional Commits: `chore` (cleanup без новой фичи)

2. **`feat(backend): add OHLCV/coin/FNG/funding-rate/gas endpoints with Redis cache`**
   - Phase 2 (Task 2.1–2.6)
   - Conventional Commits: `feat` (новые endpoints)

3. **`refactor(frontend): migrate useOHLCV/useCoinInfo/usePrices to backend + drop VITE_FINNHUB_API_KEY`**
   - Phase 3 (Task 3.1–3.6)
   - Conventional Commits: `refactor` (миграция на бэкенд)

4. **`feat(dashboard): real data for 10 remaining widgets + 2 hero components`**
   - Phase 4 (Task 4.1–4.11)
   - Conventional Commits: `feat`

5. **`fix(assetpage): currency-aware Y-axis + extra timeframes + TradingView exchange map`**
   - Phase 5 (Task 5.1–5.3)
   - Conventional Commits: `fix`

6. **`test(frontend+backend): cover new widgets, hooks, removed registry, backend endpoints`**
   - Phase 6 (Task 6.1–6.5)
   - Conventional Commits: `test`

7. **`docs: update widgets.md and AGENTS.md for 26-widget registry + new endpoints`**
   - Phase 7 (Task 7.1–7.3)
   - Conventional Commits: `docs`

## Что НЕ входит в scope

- `docs/widgets.md` рерайт с нуля — только targeted updates
- Бэкенд OAuth/Google flow (уже реализован в Блоке B)
- Полная переписка `usePrices` на бэкенд (только crypto-batch оптимизация, не весь хук)
- Дополнительные CoinGecko endpoints (markets, search) — out of scope
- Mobile responsive audit — out of scope
- E2E тесты (Playwright) — out of scope, только unit + integration

## Риски и компромиссы

1. **Whale Tracker / Liquidations остаются на демо-данных** — нет публичного free API с CORS-обходом. Помечены badge «Demo» чтобы не вводить в заблуждение.
2. **`VITE_FINNHUB_API_KEY` помечен deprecated, но не удалён** — для обратной совместимости. Полное удаление — отдельная задача.
3. **Backend новые эндпоинты не покрыты rate-limit** — Finnhub free 60 req/min, CoinGecko 30 req/min. Если нагрузка вырастет — потребуется Redis-кеш с более длинным TTL или Pro-ключ.
4. **Тесты для 10 виджетов — 10 новых test-файлов** — это +~300 строк тестового кода. Стоит рассмотреть, что часть smoke-тестов можно объединить в один файл `__tests__/dashboard-widgets.test.tsx` (один describe-block на виджет).

## Следующие шаги

После `STOP` от планировщика — пользователь запускает:

```
/aif-implement
CONTEXT FROM /aif-plan:
- Plan file: .ai-factory/plans/widgets-redis-cleanup.md
- Testing: yes
- Logging: verbose
- Docs: yes (mandatory /aif-docs checkpoint at end)
```

Альтернативно: фазы 1-3 можно выполнить в первом раунде (cleanup + backend + frontend миграция), фазы 4-7 — во втором, для удобства code review.
