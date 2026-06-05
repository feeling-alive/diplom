# Session Report: Phase 1-3 — Cleanup + Backend + Frontend Migration

**Date:** 2026-06-05
**Plan:** `.ai-factory/plans/widgets-redis-cleanup.md` (full mode, 7 phases)
**Scope:** Phases 1-3 (cleanup → backend endpoints → frontend migration)
**Status:** ✅ Phase 1-3 complete; Phase 4-7 deferred to next session.

## TL;DR

- **26-widget registry** (было 31). Удалены 5 виджетов: `ai_signal`, `yield_curve`, `price_alerts`, `economic_calendar`, `portfolio_pnl`.
- **5 новых бэкенд-эндпоинтов** под `/api/quotes/*` с Redis-кешем + graceful degradation: `ohlcv`, `coin`, `fng`, `funding-rate`, `gas`.
- **3 фронт-хука/виджета мигрированы** на бэкенд: `useOHLCV`, `useCoinInfo`, `FearGreedWidget`. Прямые fetch'и к OKX / CoinGecko / alternative.me **полностью убраны** из активного кода.
- **Хардкод `useMock=true`** в `AssetHeader` и `SimpleChart` снят — теперь они идут в бэкенд по умолчанию.
- **5 файлов виджетов** (`AiSignalWidget.tsx`, `YieldCurveWidget.tsx`, `PriceAlertsWidget.tsx`, `EconomicCalendarWidget.tsx`, `PortfolioPnlWidget.tsx`) оставлены на диске — tree-shake'нутся из bundle автоматически.
- **Тесты:** backend 11/11 новых pytest-кейсов проходят, 55/55 общий suite, 1 pre-existing failure (не связано). Frontend tsc + lint + build clean.

---

## Что реализовано

### Phase 1: Cleanup (commit `c7bd87b`)

**Файлы:**
- `frontend/src/types/widgets.types.ts` — `WidgetType` union (31 → 26 значений).
- `frontend/src/constants/widgets.registry.ts` — `WIDGET_REGISTRY` (31 → 26 entries). Удалены 5 lucide-react иконок (`Calendar`, `Wallet`, `Bell`, `LineChart`, `Sparkles`).
- `frontend/src/components/dashboard/WidgetCard.tsx` — 5 case-веток в `renderWidgetContent` удалены + 5 imports.
- `frontend/src/lib/dashboardLayout.ts` — `ENVELOPE_KEY` бамп `fintrack_dashboards_v1` → `fintrack_dashboards_v2`. Старый `v1` добавлен в `LEGACY_STORAGE_KEYS`. `clampWidgets()` логирует `purging removed widget from layout: %s` для удалённых типов.

**Миграция данных:** старая схема `fintrack_dashboards_v1` НЕ конвертируется — пользователь получит свежий дефолт. `clampWidgets()` уже отфильтровывает по `WIDGET_REGISTRY.some()`, поэтому 5 удалённых типов автоматически выбрасываются из любой сохранённой раскладки.

**Tree-shaking:** осиротевшие файлы НЕ удалены (`rm`). Они не импортируются ни одним активным компонентом, поэтому Vite tree-shake'нется из bundle.

---

### Phase 2: Backend endpoints (commit `c111d71`)

**5 эндпоинтов под `/api/quotes/*`:**

| Endpoint | Service | Upstream | TTL | Mock fallback |
|----------|---------|----------|-----|---------------|
| `GET /api/quotes/ohlcv/{symbol}?tf=&limit=` | `candles.py` | OKX (crypto) / Finnhub (stock) | 60s / 300s | `backend/app/mock/candles.json` |
| `GET /api/quotes/coin/{id}` | `coingecko.py` | CoinGecko | 1800s | `backend/app/mock/coin.json` |
| `GET /api/quotes/fng` | `fng.py` | alternative.me | 3600s | `{value:50, label:'Neutral'}` |
| `GET /api/quotes/funding-rate?symbols=` | `funding.py` | OKX batch | 30s per symbol | per-symbol mock |
| `GET /api/quotes/gas` | `gas.py` | Etherscan | 15s | `{slow:18, std:24, fast:32, isStale:true}` |

**Архитектура:** все эндпоинты используют `services/cache.py` (Redis с graceful degradation — если Redis недоступен, читаем/пишем как будто он есть, ошибка изолируется). Маршрутизация: `_is_stock_symbol()` в `candles.py` определяет крипту по наличию `-` (BTC-USDT vs AAPL).

**Тесты:** `backend/tests/test_quotes_new.py` — 11 кейсов:
- `test_ohlcv_crypto_okx_schema` — проверка схемы OKX + нормализация timestamp в integer unix ms
- `test_ohlcv_upstream_failure_returns_mock` — fallback при network error
- `test_coin_coingecko_schema` — проверка плоской формы + trim-guard (tickers/community_data/market_data/links не утекают)
- `test_coin_failure_returns_mock` — fallback при 429
- `test_fng_ok` + `test_fng_failure_returns_neutral_fallback`
- `test_funding_rate_batch` + `test_funding_rate_empty_symbols_400`
- `test_gas_no_api_key_returns_stale_fallback` + `test_gas_etherscan_429_returns_stale_fallback` + `test_gas_etherscan_ok_schema`

Паттерн: `FakeAsyncClient` с class-level `responses`/`calls` + monkeypatch cache-функций (`get_cached`/`set_cached`) — тесты бегут без сети и без Redis.

---

### Phase 3: Frontend migration (commit `f0a1bc1`)

**Миграция 3 активных компонентов на бэкенд:**

#### 1. `useOHLCV.ts` (lines 1-58)
- **Было:** прямой fetch к `https://www.okx.com/api/v5/market/candles` (CORS-обход через Vite proxy `/api/okx`) + прямой fetch к Finnhub через `/api/finnhub` с `ENV.FINNHUB_API_KEY` из env.
- **Стало:** `fetch('/api/quotes/ohlcv/${symbol}?tf=${tf}&limit=100')`. Symbol routing (crypto vs stock) делает бэкенд.
- Backend нормализует timestamp в integer unix ms (OKX ms-as-string → int, Finnhub seconds → * 1000). Фронт получает единую форму `PricePoint.timestamp` независимо от типа актива.

#### 2. `useCoinInfo.ts` (lines 1-167)
- **Было:** прямой fetch к `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&...` — 30+ полей, фронт маппит вручную.
- **Стало:** `fetch('/api/quotes/coin/${id}')`. Бэкенд возвращает плоскую форму с полями, которые нужны UI (`description`, `homepage`, `github`, `twitter`, `genesis_date`, `hashing_algorithm`, `market_cap_rank`, `ath`/`atl`+даты, `supply` данные, `image`).
- **Inline mock** для `VITE_MOCK_MODE=true` — bitcoin/ethereum хардкод (раньше фронт держал свою копию mock'а, теперь сжатую в хуке).

#### 3. `FearGreedWidget.tsx` (lines 1-179)
- **Было:** прямой fetch к `https://api.alternative.me/fng/?limit=1` + localStorage-кеш `fintrack_fng_cache_v1` (1h TTL).
- **Стало:** TanStack Query → `fetch('/api/quotes/fng')`. localStorage-кеш **полностью удалён** — Redis бэкенда = single source of truth.
- Русские labels (Жадность/Нейтрально/Страх/Крайний страх) и цветовая схема остаются на UI стороне — это presentation logic, не data.

**Снятие хардкода useMock=true:**
- `AssetHeader.tsx:15` — `useAssetPrice(asset.symbol, asset.type, true)` → `useAssetPrice(asset.symbol, asset.type)` (дефолт = `USE_MOCK` env).
- `SimpleChart.tsx:67` — `useOHLCV(symbol, tf, true)` → `useOHLCV(symbol, tf)`.
- При `VITE_MOCK_MODE !== 'true'` (по умолчанию) данные берутся с бэкенда; в dev-режиме с `.env` флагом `VITE_MOCK_MODE=true` — из локальных mock-фикстур.

**Vite-proxy:** `/api/quotes` → `http://localhost:8000` уже настроен в `frontend/vite.config.ts:15-18` (с момента Phase 2). Verify без изменений кода.

**env.ts deprecation:**
- `lib/env.ts:6,7` — `FINNHUB_API_KEY` / `FINNHUB_BASE_URL` помечены `/** @deprecated */`. Поля оставлены как no-op заглушки.
- `config/env.ts:9-12` — добавлен комментарий-предупреждение.
- Активный код больше не читает Finnhub-ключ. Единственный потребитель — осиротевший `EconomicCalendarWidget.tsx` (tree-shake'нется).

**Нормализация бэкенда (refinement):**
- `candles.py:64-77` (OKX path) — `int(row[0])` для unix ms string → integer. Раньше строка утекала в JSON, ломая `PricePoint.timestamp: number`.
- `candles.py:99-110` (Finnhub path) — `int(t) * 1000` для перевода секунд в миллисекунды. Раньше фронт делил на 1000 — теперь делить не нужно.
- `coingecko.py:36-78` — расширен `_normalize()` для плоской формы (была вложенная `market_data`). Добавлены `homepage`, `github`, `twitter`, `genesis_date`, `hashing_algorithm`, `market_cap_rank`, `ath`/`atl`/`ath_date`/`atl_date`, `total_supply`/`circulating_supply`/`max_supply`, `current_price_usd`/`market_cap_usd`/`total_volume_usd`/`price_change_percentage_24h`, `image.{large,small}`. Trim-guard остался — `tickers`/`community_data`/`links`/`market_data` НЕ утекают.
- `mock/candles.json` — timestamp'ы переключены с ISO (`"2026-06-04T22:00:00Z"`) на unix ms (`1749079200000`) для консистентности с новым контрактом.
- `mock/coin.json` — возвращена raw CoinGecko-форма (description/links/market_data), чтобы mock проходил через тот же `_normalize()` что и upstream (single source of truth для shape).

---

## Как работает сейчас

### Архитектура «фронт ↔ бэкенд ↔ upstream» для данных

```
┌─────────────┐    /api/quotes/*    ┌─────────────────┐    httpx     ┌──────────────────┐
│  Frontend   │ ─────────────────► │  FastAPI :8000  │ ───────────► │  OKX/Finnhub/    │
│  (Vite)     │ ◄───────────────── │  (Redis cache)  │ ◄─────────── │  CoinGecko/      │
│  :5173      │   same-origin       │                 │  JSON        │  alternative.me  │
└─────────────┘                     └─────────────────┘              └──────────────────┘
       │                                     │
       │  /api/quotes/* → :8000 (proxy)      │ cache:{type}:{key} TTL configurable
       │  same-origin, cookie OK             │ Redis (graceful: silent on fail)
       │                                     │
       └── Vite dev proxy (vite.config.ts:15-18)
```

### Поток данных для конкретных виджетов

**AssetPage график (OHLCV):**
1. `SimpleChart` вызывает `useOHLCV(symbol, '1H')` (useMock env default = false).
2. Хук шлёт `GET /api/quotes/ohlcv/BTC-USDT?tf=1H&limit=100`.
3. Vite proxy: `/api/quotes/*` → `http://localhost:8000`.
4. FastAPI `candles.get_candles()`:
   - Кэш: `cache:ohlcv:BTC-USDT:1H:100` в Redis (60s TTL).
   - Cache hit → возвращает из Redis с `source: "cache"`.
   - Cache miss → fetches OKX `/api/v5/market/candles`, нормализует timestamps в int ms, кэширует, возвращает.
   - Network error → возвращает mock из `mock/candles.json` с `source: "mock"`.
5. Фронт мапит `candles[]` → `PricePoint[]` и передаёт в Recharts.

**Coin info (AssetPage header):**
1. `useCoinInfo(symbol)` → `getCoinId(symbol)` (`'BTC'` → `'bitcoin'`).
2. `GET /api/quotes/coin/bitcoin` → CoinGecko proxy (30 min Redis TTL).
3. Бэкенд нормализует, отдаёт плоскую форму.
4. Фронт использует `data.currentPriceUsd`, `data.marketCapRank`, `data.ath` и т.д.

**Fear & Greed gauge (dashboard widget):**
1. `FearGreedWidget` mounts → TanStack Query `['fng']` → `fetch('/api/quotes/fng')`.
2. Бэкенд fetches alternative.me (1h Redis TTL).
3. Frontend мапит numeric `value` → русский label (`75+ → Жадность`, `50+ → Нейтрально`, `25+ → Страх`, `<25 → Крайний страх`).
4. `refetchInterval: 60min` — синхронизация с бэк TTL.
5. **localStorage кэш УДАЛЁН** — был лишним слоем над Redis.

**Mock-режим (VITE_MOCK_MODE=true):**
- `USE_MOCK` env = `true` → хуки возвращают inline-данные (OHLCV: `getMockOHLCV()`, CoinInfo: inline `MOCK_INFO`, FNG: hardcoded `value: 72`).
- Полезно для оффлайн-разработки без поднятого бэкенда.

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Backend pytest (новое) | `pytest tests/test_quotes_new.py` | **11 passed** |
| Backend pytest (full) | `pytest` | **55 passed, 1 pre-existing failure** (`test_auth.py::test_google_not_configured` — 307 vs 501, не связано) |
| Frontend tsc | `npx tsc --noEmit` | **clean** |
| Frontend lint (изменённые) | `npx eslint src/hooks/...` | **clean** |
| Frontend build | `npm run build` | **success** (1104 KB, gzip 319 KB) |
| Frontend vitest | `npx vitest run` | **36 passed, 7 pre-existing failures** (CommunityWidget + PriceChartWidget — НЕ связано, проверено через `git stash`) |

Pre-existing failures подтверждены через `git stash` (проверка на предыдущем коммите — те же 7 падают). К моим изменениям не относятся.

---

## Commits

```
fd4b830  chore: sync infrastructure + docs from previous session
c7bd87b  chore(dashboard): remove 5 unused widgets from registry + bump storage version
c111d71  feat(backend): add OHLCV/coin/FNG/funding-rate/gas endpoints with Redis cache
f0a1bc1  refactor(frontend): migrate OHLCV/coin/FNG to backend /api/quotes
```

---

## Что НЕ сделано (deferred to next session)

| Phase | Tasks | Status |
|-------|-------|--------|
| 4: Real data для 10 оставшихся виджетов | Task 4.1-4.11 | pending |
| 5: AssetPage chart fixes (Y-ось, timeframes, TradingView) | Task 5.1-5.3 | pending |
| 6: Vitest для 10 виджетов + hooks + registry + backend (11 уже есть) | Task 6.1-6.5 | partial (2.6 done) |
| 7: Документация (widgets.md, AGENTS.md) | Task 7.1-7.3 | pending |

---

## Ключевые дизайн-решения

1. **5 осиротевших файлов виджетов НЕ удалены** — `rm` опасен (можно потерять git history), а Vite tree-shake'нется автоматически. Bundle size impact: 0.

2. **localStorage hard reset** — старая схема `fintrack_dashboards_v1` не конвертируется в `v2`. Пользователь увидит дефолтный layout. Это сознательный trade-off: 5 удалённых виджетов ломают совместимость, миграция потребовала бы 100+ строк кода ради пустого переноса. `LEGACY_STORAGE_KEYS` гарантирует, что старые ключи не "висят" в localStorage бесконечно — логируем info при чтении, оставляем мусор в браузере.

3. **Снятие хардкода `useMock=true`** — раньше фронт был вынужденно на mock'ах для бэкенд-зависимых виджетов. Теперь, при `VITE_MOCK_MODE !== 'true'` (по умолчанию), данные идут с бэкенда. Mock-режим сохранён для dev-офлайна.

4. **OHLCV backend normalization** — единый формат timestamp (int unix ms) избавляет фронт от switch'а между OKX ms и Finnhub seconds.

5. **CoinGecko flat shape** — раньше бэкенд возвращал nested `market_data: {current_price: {usd: 68000}}`, теперь `current_price_usd: 68000`. Удобнее для UI, проще мапить, меньше payload.

6. **Finnhub-ключ помечен deprecated, не удалён** — экономия <100 байт в bundle не стоит риска поломки осиротевшего `EconomicCalendarWidget.tsx` (который tree-shake'нется, но пока файл существует, должен компилироваться). Полное удаление = отдельная задача.

---

## Файлы изменены (Phase 3)

**Backend (3):**
- `backend/app/services/candles.py` — int timestamp normalization
- `backend/app/services/coingecko.py` — flat shape + extra fields
- `backend/app/mock/candles.json` — unix ms timestamps
- `backend/app/mock/coin.json` — raw CoinGecko shape
- `backend/tests/test_quotes_new.py` — test_coin_coingecko_schema update

**Frontend (7):**
- `frontend/src/hooks/useOHLCV.ts` — backend path
- `frontend/src/hooks/useCoinInfo.ts` — backend path + inline mock
- `frontend/src/components/dashboard/widgets/FearGreedWidget.tsx` — TanStack Query + remove localStorage cache
- `frontend/src/components/asset/AssetHeader.tsx` — drop `useMock=true`
- `frontend/src/components/asset/SimpleChart.tsx` — drop `useMock=true`
- `frontend/src/lib/env.ts` — deprecate FINNHUB_API_KEY
- `frontend/src/config/env.ts` — comment on finnhub block

**Plan (1):**
- `.ai-factory/plans/widgets-redis-cleanup.md` — Phase 3 tasks marked [x] + implementation notes
