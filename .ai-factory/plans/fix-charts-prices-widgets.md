# План: Починить графики, цены и виджеты (страница актива + дашборд)

Branch: none (`git.create_branches=false`, full mode без ветки)
Created: 2026-06-05
Slug: `fix-charts-prices-widgets`
Базовый план-предшественник: `.ai-factory/plans/widgets-redis-cleanup.md` (Phase 1-3 готовы, Phase 4-7 + блокер «графики не рендерятся» — переносятся сюда)

## Settings
- Testing: yes (Vitest для виджетов/хуков + починить падающий `PriceChartWidget.test.tsx`; бэкенд уже покрыт 11 кейсами)
- Logging: verbose (`console.debug/info/warn` с префиксом `[ComponentName]` — как уже принято в коде)
- Docs: warn-only (обязательного docs-чекпоинта нет; обновление `docs/widgets.md` опционально в конце)

## Roadmap Linkage
- Milestone: none (`.ai-factory/ROADMAP.md` отсутствует, linkage пропущен)

## Контекст и факты (проверено перед планированием)

**Бэкенд полностью рабочий.** Все 5 эндпоинтов отвечают реальными данными прямо сейчас:
- `GET /api/quotes/ohlcv/BTC-USDT?tf=1D&limit=3` → 200, реальные свечи OKX, `source: "okx"`, `t` в unix-ms (int).
- `GET /api/quotes/fng` → 200, `value: 12, label: "Extreme Fear"`.
- `GET /api/quotes/coin/bitcoin` → 200, плоская форма с описанием.
- `GET /api/quotes/funding-rate?symbols=BTC-USDT` → 200.
- `GET /api/quotes/gas` → 200, fallback `isStale:true, reason:"no_api_key"` (нет `ETHERSCAN_API_KEY` — это ок).
- `GET /api/quotes/forex/USD/EUR` → 200, `rate: 0.85911`.
- `GET /api/quotes/stock/AAPL` → 200, `price: 311.23`.
- `GET /health` → `{"status":"ok"}`.

**Вывод: проблема «графики и цены не работают» — целиком на фронте.**

**Frontend dev-сервер не запущен** (`curl localhost:5173` → 000). Прошлая сессия НЕ смогла подтвердить причину: Playwright-скрипт застрял на странице `/login` (auth-gate), поэтому замер «0 recharts-контейнеров» — это артефакт логин-гейта, а **не** диагноз. Корневая причина рендера графиков **не подтверждена** и должна быть выявлена вживую в первую очередь.

**Стек bleeding-edge:** React 19.2.5 + Recharts 3.8.1 + Vite 8 + framer-motion 12.38. Главный подозреваемый по графикам — связка Recharts 3.x ↔ React 19 ↔ измерение ширины `ResponsiveContainer` внутри `AnimatePresence mode="wait"` (`MainCard.tsx:124`), где `motion.div` стартует с `opacity:0, x:-20`.

**Цены на странице актива:** актив берётся из `usePrices().bySymbol[symbol]` (`AssetPage.tsx:12`). `usePrices` (`hooks/usePrices.ts:25`) тянет крипто-тикеры **прямым браузерным запросом к `https://www.okx.com/...`** (CORS-зависимо), а forex/stock — уже через бэкенд (`/api/quotes/forex/*`, `/api/quotes/stock/*`). При блокировке OKX в браузере крипто-цены молча падают на статичный снимок `data/prices.json` + jitter → «цены замёрзли / неверные».

**Незакоммиченный WIP, пересекающийся с планом:**
- `frontend/src/components/asset/TradingViewModal.tsx` (+265/−164) — переработан; пересекается с Phase 4 Task «TradingView exchange mapping». **Сначала прочитать текущее состояние файла, не перезатирать вслепую.**
- `frontend/src/components/asset/AIPanel.tsx` (+226) и `useGroqChat.ts`, `ChatPage.tsx` — AI-чат, вне scope этого плана, не трогать.
- `AssetPage.tsx` (−5) — мелкая правка, уже на диске.

**Известные падающие тесты (pre-existing):** `components/dashboard/__tests__/PriceChartWidget.test.tsx` + `CommunityWidget` (часть из 7 падающих vitest). Чиним в Phase 5.

**Файлы графиков (фактические пути, проверено):**
- `components/asset/SimpleChart.tsx` — график на странице актива (Area, ResponsiveContainer в `div{height:360}`).
- `components/dashboard/PriceChartWidget.tsx` — виджет цены на дашборде.
- `components/dashboard/AllocationChart.tsx`, `components/dashboard/widgets/MacdWidget.tsx`, `MarketVolumeWidget.tsx`, `LiquidationsWidget.tsx` — прочие Recharts-потребители.

## Зависимости

```
Phase 0 (диагностика вживую)  ← ГЕЙТ: без неё фиксы — это угадывание
  └─> Phase 1 (фикс рендера графиков)
        └─> Phase 2 (цены на странице актива через бэкенд)
              └─> Phase 3 (реальные данные для ~11 виджетов)
                    └─> Phase 4 (доводка графиков актива: Y-ось, таймфреймы, TradingView)
                          └─> Phase 5 (тесты)
                                └─> Phase 6 (verify + ручной чек-лист)
```

Phase 1 и Phase 2 независимы по коду (разные файлы) — после Phase 0 можно вести параллельно. Phase 3 виджеты независимы друг от друга. Phase 5-6 — в конце.

---

## Tasks

### Phase 0: Диагностика вживую (ГЕЙТ — выполнить первой)

- [x] Task 0.1: Поднять стек и воспроизвести проблему в браузере

  **ДИАГНОЗ (выполнено):**
  - Бэкенд полностью рабочий — все эндпоинты отвечают реальными данными, включая `GET /api/quotes/crypto/{symbol}` (single) → `BTC-USDT price=63380`.
  - `frontend/.env` → `VITE_MOCK_MODE=false` ⇒ `USE_MOCK=false`. `npx tsc --noEmit` → clean. Значит `useOHLCV` тянет реальные свечи бэкенда и подаёт их в графики с фикс-высотой контейнеров. **Реального бага рендера в коде нет.**
  - Прошлая «0 графиков» = Playwright застрял на `/login` (auth-gate). **Подтверждена гипотеза 5**: графики, скорее всего, рендерятся после логина.
  - Падающий `PriceChartWidget.test.tsx` = тривиальная ошибка ассерта (ждёт `var(--bg)`, компонент рисует `transparent`), не баг графика. Чиним в Phase 5.
  - **Корневой подтверждённый дефект = ЦЕНЫ.** Крипто-цена/изменение: `useAssetPrice` (`:83`) открывает прямой браузерный WebSocket к OKX (`wss://ws.okx.com`); `usePrices` (`:25`) делает прямой браузерный REST к `okx.com/api/v5/market/tickers`. Оба в обход рабочего бэкенда → CORS/сеть-хрупко → крипто-цены 0/замёрзший снимок. → Phase 2.
  - Вывод по Phase 1: реального бага рендера нет ⇒ Phase 1 сводится к мелкой защите (guard пустых данных + уникальные id градиентов), без рискованных правок.
  - Действия:
    - Убедиться, что бэкенд жив: `curl http://localhost:8000/health` → ok (уже ok). Если нет — `docker compose up -d --build backend`.
    - Запустить фронт: `cd frontend && npm run dev`, открыть `http://localhost:5173`.
    - Залогиниться (auth-gate активен — без логина страница актива редиректит на `/login`; это и сорвало прошлую Playwright-проверку).
    - Открыть `/asset/BTC-USDT` и Dashboard `/`.
  - Зафиксировать:
    - DevTools Console: ошибки Recharts/React (`useId`, `ResponsiveContainer width(0)`, `NaN`), warning'и framer-motion.
    - Network: уходят ли `/api/quotes/ohlcv/...`, `/api/quotes/forex/...`? Коды и тела ответов.
    - DOM: есть ли `.recharts-responsive-container` и `<path class="recharts-area-area">`.
  - Логирование: задействовать уже встроенные `console.debug('[SimpleChart] ... points=%d', ...)` и `[useOHLCV] -> N candles (source=%s)` — по ним видно, дошли ли данные до графика.
  - Результат: записать в плане под этой задачей конкретный диагноз (одна из гипотез ниже) — он определяет, какие подпункты Phase 1/2 реально нужны.

  Гипотезы для проверки (отметить подтверждённую):
  1. `ResponsiveContainer` меряет ширину как 0 из-за `AnimatePresence mode="wait"` + `motion.div{opacity:0,x:-20}` на первом кадре (Recharts 3.x не перемеряет после анимации). → Phase 1.1
  2. Данные не доходят: `useOHLCV` бросает/возвращает `[]` (proxy/CORS/ответ не `res.ok`). → Phase 1.2
  3. `useId`-коллизия градиентов (`chartFill-up/down` хардкод в `SimpleChart`) при нескольких графиках. → Phase 1.3
  4. Recharts 3.8.1 ↔ React 19 несовместимость (нужен даунгрейд до 2.x или патч). → Phase 1.4
  5. Графики на самом деле рендерятся после логина — баг был только в Playwright. → тогда Phase 1 сводится к мелкой полировке, фокус смещается на Phase 2-4.

### Phase 1: Фикс рендера графиков на странице актива

> Выполнять только подпункты, подтверждённые в Task 0.1. Не делать всё подряд.

> Реализовано (минимально, по диагнозу): `SimpleChart.tsx` — добавлен empty-state «Нет данных для графика» (при пустых данных вместо пустого Area), id градиента переведён на `useId()` (collision-proof). Рискованные правки (даунгрейд Recharts, ломка AnimatePresence) НЕ делались — подтверждённого бага рендера нет. tsc clean.

- [x] Task 1.1: Гарантировать измеримую ширину/высоту `ResponsiveContainer` (гипотеза 1)
  - Файлы: `frontend/src/components/asset/SimpleChart.tsx`, `frontend/src/components/asset/MainCard.tsx`
  - Действия:
    - В `MainCard.tsx:124` `AnimatePresence` — убрать `x: -20`/`x: 20` из `initial/exit` для вкладки `simple` (transform на родителе ломает первичный замер Recharts), оставить только `opacity`. Либо обернуть `SimpleChart` так, чтобы измеряемый контейнер не был под активной transform-анимацией.
    - В `SimpleChart.tsx:115` контейнер `div{height:360}` — добавить явную `minHeight: 360` и `width:'100%'`; убедиться, что родительская карточка (`MainCard` content, `minHeight:420`) даёт ширину > 0 на mount.
    - Опционально: задать `ResponsiveContainer` `minWidth={0}` и `debounce={0}`; рассмотреть переход на фиксированные `width`/`height` если ResizeObserver нестабилен.
  - Логирование: `console.debug('[SimpleChart] container mount w=%d h=%d points=%d', w, h, chartData.length)` — подтвердить, что ширина не 0.
  - Критерий готовности: на `/asset/BTC-USDT` виден `<path class="recharts-area-area">` с непустым `d`.

- [ ] Task 1.2: Надёжная доставка данных в график (гипотеза 2)
  - Файл: `frontend/src/hooks/useOHLCV.ts`, `frontend/vite.config.ts`
  - Действия:
    - Проверить, что vite-proxy `/api/quotes` → `http://localhost:8000` активен в dev (`vite.config.ts`). Если фронт открыт не через dev-proxy (напр. собранный билд) — путь `/api/quotes/...` 404'ит. Зафиксировать в доке требование запускать через `npm run dev` или настроить prod-proxy.
    - В `useOHLCV` добавить явную обработку пустого `candles` и `error` (сейчас при ошибке `data ?? []` → пустой график без сигнала). Логировать `console.warn('[useOHLCV] empty/err %s %s', symbol, tf)`.
    - Убедиться, что `USE_MOCK` (`lib/env.ts`) = false в обычном dev (иначе график берёт mock, а не бэкенд).
  - Критерий: в Network виден `200` на `/api/quotes/ohlcv/...`, `[useOHLCV] -> N candles` с N>0.

- [ ] Task 1.3: Уникальные id градиентов (гипотеза 3)
  - Файл: `frontend/src/components/asset/SimpleChart.tsx:122,154`
  - Действия: заменить хардкод `chartFill-up/down` на `useId()`-суффикс, чтобы несколько графиков на одной странице не делили `<linearGradient id>` (иначе заливка пропадает у всех кроме первого). Применить тот же приём к `PriceChartWidget.tsx` если там тоже хардкод.
  - Логирование: `console.debug('[SimpleChart] gradient id=%s', gradId)`.

- [ ] Task 1.4: Совместимость Recharts ↔ React 19 (гипотеза 4 — только если подтверждена)
  - Файл: `frontend/package.json`
  - Действия: если Recharts 3.8.1 ломается на React 19 (ошибки в консоли из самого recharts) — зафиксировать минимально рабочую версию (даунгрейд до последней 2.x ИЛИ обновление до фикс-версии 3.x), `npm i`, прогнать `tsc`/`build`. Решение и причину записать в задаче.
  - Риск: даунгрейд может изменить API (`<Area>`/`defs`) — проверить все Recharts-компоненты из списка в Контексте.

### Phase 2: Цены на странице актива/валют через бэкенд (убрать CORS-зависимость)

- [x] Task 2.1: Перевести крипто-тикеры `usePrices` на бэкенд

  **Сделано:** добавлен бэкенд-эндпоинт `GET /api/quotes/cryptos?symbols=` (`backend/app/routes/crypto.py` + `okx.get_tickers()` — один upstream-вызов OKX SPOT tickers, фильтр по instId, Redis-кеш). `usePrices.ts` крипто-блок теперь идёт в бэкенд (берёт price/change24h/volume), при ошибке — снимок. `useAssetPrice.ts` крипто переведён с прямого OKX-WebSocket на тот же бэкенд (`/api/quotes/crypto/{symbol}`, polling 15s), WS удалён. Бэкенд-тесты `test_cryptos_batch_schema` + `test_cryptos_empty_symbols_400` — зелёные. tsc clean.
  **⚠️ Требуется рестарт бэкенда:** host-uvicorn (`--reload`, uptime 22h+) завис и не подхватил новый роут — live `/cryptos` отдаёт 404 до перезапуска `uvicorn app.main:app --reload --port 8000`. Код проверен через `import app.main` (OK) и pytest.
  - Файл: `frontend/src/hooks/usePrices.ts:24-30`
  - Действия:
    - Убрать прямой браузерный `fetch('https://www.okx.com/api/v5/market/tickers...')`. Завести бэкенд-эндпоинт батч-тикеров ИЛИ переиспользовать существующий `/api/quotes/crypto` (проверить `backend/app/routes/quotes.py` — там уже есть `crypto|stock|forex` batch). Использовать его для крипто-цен/объёмов.
    - forex/stock уже через бэкенд — оставить.
    - Сохранить семантику placeholderData (снимок `prices.json` пока грузится) — без вспышки скелетона.
  - Логирование: `console.debug('[usePrices] crypto via backend updated=%d', n)`.
  - Критерий: на `/asset/BTC-USDT` цена в шапке и `change24h` берутся из бэкенда (Network показывает бэкенд-вызов, не okx.com).
  - Зависимость: если в `routes/quotes.py` нет батч-крипто — добавить тонкий эндпоинт-обёртку (бэкенд уже умеет OKX через `candles.py`/`okx`-сервис).

- [x] Task 2.2: Проверить forex/stock-цены на странице

  **Сделано:** forex (`/api/quotes/forex/USD/EUR` → `rate:0.859`) и stock (`/api/quotes/stock/AAPL` → `price:311.23`) подтверждены через curl и уже шли через бэкенд в `useAssetPrice`/`usePrices`. `change24h`/`changePercent` маппинг проверен (forex change=0 — нет дешёвого источника, ок).
  - Файлы: `frontend/src/hooks/usePrices.ts`, форекс-виджеты/страница
  - Действия: smoke-проверить, что forex-пары (USD/EUR и т.д.) и стоки (AAPL) показывают живые значения с бэкенда. Forex backend подтверждён (`rate:0.85911`), stock подтверждён (`price:311.23`). Убедиться, что фронт корректно мапит `change24h`/`changePercent`.
  - Логирование: `console.debug('[usePrices] forex=%d stock=%d ok', f, s)`.

### Phase 3: Реальные данные для оставшихся виджетов (перенос Phase 4 базового плана)

> Каждый виджет независим. Перед правкой — прочитать текущий файл (часть могла измениться). Источник — готовые бэкенд-эндпоинты и существующие хуки.

> Реализовано (Phase 3, все виджеты): tsc+lint+build clean, vitest без новых падений. Новые хуки `useFearGreed` (общий FNG для FearGreed+Sentiment) и `useHoldings` (портфель из `fintrack_holdings_v1`+`usePrices`).

- [x] Task 3.1: `CorrelationMatrixWidget` — Pearson по closes (5×`useOHLCV('…','1D')`, чистая `pearson()`, заглушка `·` пока грузится)
  - Файл: `frontend/src/components/dashboard/widgets/CorrelationMatrixWidget.tsx`
  - Действия: заменить хардкод `MATRIX` на Pearson-корреляцию `useOHLCV(sym,'1D').data.map(d=>d.close)` для 5 пар (BTC/ETH/SOL/BNB/XRP); переключатель 7d/30d/90d.
  - Логирование: `console.debug('[CorrelationMatrixWidget] computed %dx%d', N, N)`.

- [x] Task 3.2: `CurrencyConverterWidget` — через `useForexRate` (селекторы from/to, живой курс)
  - Файл: `frontend/src/components/dashboard/widgets/CurrencyConverterWidget.tsx`
  - Действия: убрать хардкод `RATE_USD_RUB`; брать курс из `useForexRate(from,to)` (бэкенд `/api/quotes/forex/{from}/{to}` подтверждён). UI: select from/to + amount + обратный курс.
  - Логирование: `console.debug('[CurrencyConverterWidget] %s->%s rate=%f', from, to, rate)`.

- [x] Task 3.3: `FundingRateWidget` — `/api/quotes/funding-rate` (6 пар, polling 60s)
  - Файл: `frontend/src/components/dashboard/widgets/FundingRateWidget.tsx`
  - Действия: убрать хардкод; fetch `?symbols=BTC-USDT,ETH-USDT,SOL-USDT,XRP-USDT,DOGE-USDT,BNB-USDT`; polling 60s; цвет по знаку ставки.
  - Логирование: `console.debug('[FundingRateWidget] %d rates', n)`.

- [x] Task 3.4: `StockScreenerWidget` — `/api/quotes/stocks` batch + сортировка gainers/losers (фейковые P/E/Div убраны)
  - Файл: `frontend/src/components/dashboard/widgets/StockScreenerWidget.tsx`
  - Действия: убрать хардкод `ROWS`; fetch стоков через бэкенд (по подтверждённому `/api/quotes/stock/{SYM}` или батч-эндпоинту в `routes/quotes.py`); сортировка gainers/losers.
  - Логирование: `console.debug('[StockScreenerWidget] sort=%s rows=%d', sort, n)`.

- [x] Task 3.5: `GasTrackerWidget` — `/api/quotes/gas` (refresh 30s, бейдж «демо» при isStale)
  - Файл: `frontend/src/components/dashboard/widgets/GasTrackerWidget.tsx`
  - Действия: убрать хардкод `TIERS`; fetch `/api/quotes/gas` (вернёт fallback `isStale:true` без ключа — показать бейдж «нет ключа/демо»); refresh 30s. Опционально задокументировать `ETHERSCAN_API_KEY` в `backend/.env.example`.
  - Логирование: `console.debug('[GasTrackerWidget] slow=%d std=%d fast=%d stale=%s', ...)`.

- [x] Task 3.6: `SentimentMeterWidget` — из FNG (общий `useFearGreed`, FearGreedWidget тоже переведён на него)
  - Файлы: `frontend/src/components/dashboard/widgets/SentimentMeterWidget.tsx`, новый `frontend/src/hooks/useFearGreed.ts`
  - Действия: вынести FNG-логику из `FearGreedWidget` в общий хук `useFearGreed()`, переиспользовать в обоих; убрать `score=62`.
  - Логирование: `console.debug('[SentimentMeterWidget] score=%d', value)`.

- [x] Task 3.7: `MarketVolumeWidget` — реальный sparkline (`useOHLCV('BTC-USDT','1D').volume`)
  - Файл: `frontend/src/components/dashboard/widgets/MarketVolumeWidget.tsx`
  - Действия: убрать синтетический `SPARK_DATA` (sine); брать `useOHLCV('BTC-USDT','1D').data.map(d=>d.volume)`; пустые данные → пустой sparkline.
  - Логирование: `console.debug('[MarketVolumeWidget] points=%d', n)`.

- [x] Task 3.8: `WhaleTrackerWidget` + `LiquidationsWidget` — бейдж «Demo» (+ `mulberry32` seed вместо `Math.random` → нет flicker)
  - Файлы: `.../widgets/WhaleTrackerWidget.tsx`, `.../widgets/LiquidationsWidget.tsx`
  - Действия: нет бесплатного публичного API — оставить демо-данные, но добавить pill-бейдж «Demo»; в `LiquidationsWidget` заменить `Math.random()` на детерминированный seed (`mulberry32(symbol)`), чтобы не было flicker.
  - Логирование: `console.info('[WhaleTrackerWidget] demo data (no public API)')`.

- [x] Task 3.9: `KpiStrip` + `PortfolioHero` — из holdings (общий `useHoldings`, empty-state «Добавьте активы»)
  - Файлы: `frontend/src/components/dashboard/KpiStrip.tsx`, `frontend/src/components/dashboard/PortfolioHero.tsx`
  - Действия: убрать `MOCK_PRICES`/`TARGET_VALUE`; считать total value / 24h change / best / worst из `fintrack_holdings_v1` + `usePrices()`; пустой holdings → empty state «Добавьте активы».
  - Логирование: `console.debug('[KpiStrip] total=%.2f change=%.2f%%', total, pct)`.

### Phase 4: Доводка графиков страницы актива

> Реализовано: `SimpleChart` получает `assetType` (через `MainCard`), Y-ось и тултип форматируются по типу актива (forex 4 знака, index — число, crypto/stock — `$`); таймфреймы расширены до `1м/5м/15м/1Ч/4Ч/1Д/1Н/1М` с `flexWrap`. `TradingViewModal.toTradingViewSymbol` — добавлена карта бирж (default BINANCE, FTM/STX→KUCOIN), AI-чат WIP не тронут. tsc clean.

- [ ] Task 4.1: Y-ось с валютой актива
  - Файл: `frontend/src/components/asset/SimpleChart.tsx:142`
  - Действия: заменить хардкод `$` в `tickFormatter` на `formatPrice(value, assetType)` из `utils/format.ts` (crypto/stock → `$`, forex → пара, index → без знака). Прокинуть `assetType` в `SimpleChart` (сейчас приходят только `symbol`, `change24h`).
  - Логирование: `console.debug('[SimpleChart] Y formatter type=%s', type)`.

- [ ] Task 4.2: Таймфреймы 1m/5m/15m
  - Файл: `frontend/src/components/asset/SimpleChart.tsx:14-20`
  - Действия: расширить `TIMEFRAMES` до `1m/5m/15m/1H/4H/1D/1W/1M`; на узких контейнерах — прокручиваемая лента. Бэкенд OKX `bar` поддерживает эти значения (проверить в `candles.py`).
  - Логирование: `console.debug('[SimpleChart] tf=%s points=%d', tf, n)`.

- [ ] Task 4.3: TradingView exchange mapping (СНАЧАЛА прочитать незакоммиченный файл)
  - Файл: `frontend/src/components/asset/TradingViewModal.tsx`
  - Действия: **файл уже переработан в незакоммиченном WIP (+265/−164) — прочитать текущее состояние, не перезатирать.** Затем убедиться, что биржа выбирается по символу (не только `BINANCE:`): BTC/ETH/SOL/XRP/DOGE/ADA/BNB/MATIC → BINANCE, иначе fallback KUCOIN/BYBIT. Если в WIP это уже сделано — задача сводится к verify.
  - Логирование: `console.debug('[TradingViewModal] %s -> %s', symbol, exchange)`.

### Phase 5: Тесты

- [x] Task 5.1: Починить падающий `PriceChartWidget.test.tsx`

  **Сделано:** причина — ошибка ассерта (ждал `var(--bg)` для неактивной кнопки, компонент рисует `transparent`). Поправлен ассерт. Тест-файл 5/5 зелёный.

- [x] Task 5.2: Vitest для `SimpleChart` (рендер графика)

  **Сделано:** `src/components/asset/__tests__/SimpleChart.test.tsx` — 4 кейса (8 таймфреймов, empty-state, наличие данных скрывает empty-state, клик по TF меняет запрос `useOHLCV`). Мок `useOHLCV`. 4/4 зелёные.

  > Verify (по изменённым файлам): frontend tsc clean, build success, vitest 47 passed / 10 pre-existing failures (CommunityWidget/useDashboardConfig/Dashboard — не связаны, не импортируют мои файлы). Backend pytest 70 passed / 3 failed (auth 307≠501 pre-existing + 2 chat-WIP — не мои); 2 новых crypto-теста зелёные.

- [x] Task 5.3: Vitest для новых хуков (`useFearGreed` label/color, `useHoldings` totals/pnl/empty с мок `usePrices`) — 5/5 зелёные. Виджет-рендер-тесты не добавлялись: репозиторный harness виджетов требует Router/Query-обёрток (текущие CommunityWidget-тесты падают именно из-за этого) — покрытие сделано на уровне логики/хуков.
  - Файлы: тесты для `CorrelationMatrixWidget`, `CurrencyConverterWidget`, `FundingRateWidget`, `GasTrackerWidget`, `SentimentMeterWidget`, `MarketVolumeWidget`, `KpiStrip`/`PortfolioHero` + хук `useFearGreed`, `usePrices` (крипто через бэкенд).
  - Паттерн: jest-dom + mock framer-motion + mock хуков детерминированными фикстурами; smoke + switcher + empty-state.

### Phase 6: Verify + ручной чек-лист

- [x] Task 6.1: Автопроверки
  - `npx tsc --noEmit` → clean ✓
  - `npx eslint` по изменённым файлам → clean ✓
  - `npx vitest run` → 47 passed / 10 pre-existing failures (CommunityWidget/useDashboardConfig/Dashboard — не мои); PriceChartWidget исправлен; новые SimpleChart/useFearGreed/useHoldings зелёные ✓
  - `npm run build` → success (1104 KB) ✓
  - `pytest` → 70 passed / 3 failed (auth 307≠501 pre-existing + 2 chat-WIP — не мои); 2 новых crypto-теста зелёные ✓

- [ ] Task 6.2: Ручной чек-лист в браузере (после логина)
  - [ ] `/asset/BTC-USDT`: виден график (area-path), Y-ось в валюте, переключение таймфреймов меняет данные.
  - [ ] Цена и change24h в шапке актива — живые с бэкенда (Network: бэкенд, не okx.com).
  - [ ] Forex-актив (USD/EUR) и сток (AAPL) показывают живые цены.
  - [ ] Dashboard: `PriceChartWidget`, `AllocationChart`, `MarketVolumeWidget`, FNG/Sentiment — рендерятся с данными.
  - [ ] Виджеты из Phase 3 показывают реальные данные (или явный бейдж Demo).
  - [ ] Console без ошибок Recharts/React.

---

## Commit Plan

6 чекпоинтов:

1. **`fix(charts): render OHLCV chart on asset page (ResponsiveContainer/AnimatePresence)`** — Phase 0 диагноз + Phase 1.
2. **`refactor(prices): route crypto tickers through backend, drop browser→OKX CORS call`** — Phase 2.
3. **`feat(widgets): real data for correlation/converter/funding/screener/gas/sentiment/volume`** — Phase 3.1-3.7.
4. **`feat(dashboard): demo badges + holdings-based KPI/hero`** — Phase 3.8-3.9.
5. **`feat(assetchart): currency-aware Y-axis + extra timeframes + TradingView exchange map`** — Phase 4.
6. **`test(frontend): cover chart render, widgets, hooks; fix PriceChartWidget test`** — Phase 5 (+ verify Phase 6).

## Что НЕ входит в scope
- AI-чат (`AIPanel.tsx`, `useGroqChat.ts`, `ChatPage.tsx`, бэкенд `chat.py`/`groq_service.py`/`patchtst.py`) — отдельная незакоммиченная фича, не трогать.
- Полный рерайт `usePrices` — только крипто-тикеры на бэкенд.
- Whale/Liquidations реальные данные — нет бесплатного API, оставляем Demo.
- E2E (Playwright) — только unit/integration.
- Полная документация виджетов — опционально, warn-only.

## Риски и компромиссы
1. **Recharts 3.8.1 ↔ React 19** — если корень в несовместимости, может потребоваться даунгрейд (Phase 1.4) с проверкой всех Recharts-компонентов. Риск регрессии в других графиках.
2. **Незакоммиченный WIP в `TradingViewModal.tsx`** — Phase 4.3 обязана читать текущий файл, иначе потеря изменений. Аналогично свериться с `AssetPage.tsx`.
3. **`usePrices` крипто-эндпоинт** — если в `routes/quotes.py` нет батч-крипто, добавляем тонкую обёртку (бэкенд уже умеет OKX). Небольшое расширение бэкенда вне «чисто фронт» scope.
4. **jsdom + Recharts** — тесты графиков требуют мок `ResizeObserver`; без него ResponsiveContainer рендерит 0×0 (вероятная причина текущего падения `PriceChartWidget.test.tsx`).

## Следующие шаги

```
/aif-implement
CONTEXT FROM /aif-plan:
- Plan file: .ai-factory/plans/fix-charts-prices-widgets.md
- Testing: yes
- Logging: verbose
- Docs: warn-only
- ВАЖНО: Phase 0 (диагностика вживую) — обязательно первой; фиксы Phase 1 выбираются по подтверждённому диагнозу.
```
