# План: Backend — FastAPI + Redis-прокси с кэшем котировок

**Ветка:** `master` (git.create_branches=false — остаёмся на текущей ветке)
**Источник задачи:** `promtback.md`
**Дата:** 2026-05-30
**Тип:** feature (новый сервис)
**Связанные планы:** `widget-fix.md`, `widget-dnd-enhancements.md` (фронт завершён, не пересоздавать)

---

## Settings

- **Testing:** Только smoke — pytest не пишем. Верификация = `uvicorn` стартует без трейсбэков + `curl` по каждому эндпоинту + `cache HIT` в логах при повторе. Фронт-тесты (Vitest) не трогаем и не ломаем.
- **Logging:** Verbose — Python `logging` (INFO): на каждый запрос `cache HIT/MISS`, внешний вызов, TTL; при старте — конфиг (Redis URL, наличие ключа — без печати самого ключа). Стиль `[имя_сервиса] ...` в духе фронтовых `console.debug`.
- **Docs:** Yes (обязательный чекпоинт) — на финале через `/aif-docs`: обновить раздел «Слой данных» в `PROJECT_STATE.md` + создать `backend/README.md`.

---

## Roadmap Linkage

**Milestone:** `none` — **Rationale:** roadmap-артефакт (`.ai-factory/ROADMAP.md`) в проекте отсутствует.

---

## 🔴 Безопасность — УТЁКШИЙ КЛЮЧ, действие до старта

Finnhub-ключ (`d828ic9r0…`, из `promtback.md`) **скомпрометирован — он в публичном git и в HEAD**:

- `04e166b` (14 мая) закоммитил файл `.env` с ключом → он в истории (`04e166b`, `5c57d0d`, `85b4483`). `.gitignore` для `.env` добавили **позже**, историю это не чистит.
- Ключ также лежит в **отслеживаемом `proxy.md`** в текущем HEAD (`a7a86e6`) — это сохранённые логи vite-proxy с `?token=…` в URL.
- Репозиторий публичный (`github.com/feeling-alive/diplom`) → ключ доступен любому.

**Обязательные действия (вне кода бэкенда, сделать прежде запуска):**
1. **Перевыпустить ключ** в кабинете Finnhub — старый считать мёртвым. Первично; чистка истории без ротации бессмысленна.
2. Удалить ключ из tracked-файлов: вычистить `proxy.md` (или убрать из-под git и в `.gitignore`). Чистку истории git (`git filter-repo` + force-push) — на усмотрение; для диплома достаточно ротации + удаления из HEAD.
3. Новый ключ — только в `backend/.env` (покрыт корневым `.gitignore` паттерном `.env`/`.env.*`); в `backend/.env.example` — плейсхолдер `FINNHUB_API_KEY=your_key_here`.

---

## Цель

Поднять отдельный сервис `backend/` (FastAPI + Redis), проксирующий и кэширующий запросы к Finnhub / OKX / Frankfurter, чтобы фронт перестал ходить во внешние API напрямую и не светил ключ в браузере. **В этой итерации хуки фронта НЕ переписываем** — поднимаем бэкенд, добавляем vite-proxy (Вариант A) и описываем план миграции хуков на потом (по явному требованию ТЗ «хуки не трогать, просто показать»).

---

## Принятые решения (зафиксированы через /aif-plan)

| Вопрос | Решение |
|---|---|
| Vite-proxy | **Вариант A (аддитивный):** добавить только `/api/quotes → :8000`, старые 4 правила (`/api/finnhub`, `/api/news`, `/api/forex`, `/api/okx`) оставить. Миграция хуков — отдельной итерацией. |
| Redis для дев/демо | **Docker:** `docker run -p 6379:6379 redis:alpine`. README пишем под него. |
| Недоступный Redis | **Graceful degradation:** лог `cache unavailable` + прямой вызов внешнего API. Бэкенд не падает. |
| Volume для акций | Finnhub `/quote` объём не отдаёт → возвращаем `0` (без доп. запроса к `/stock/metric`). |

---

## Контекст из текущей кодовой базы (файлы прочитаны)

Как фронт ходит в API **сейчас** — важно для стыковки и будущей миграции:

| Хук / файл | API | Способ обращения |
|---|---|---|
| `src/hooks/usePrices.ts:32` | OKX SPOT tickers (батч крипты) | **Прямой fetch** `https://www.okx.com/api/v5/...` (мимо proxy) |
| `src/hooks/usePrices.ts:40` | Frankfurter (форекс) | `${ENV.FRANKFURTER_BASE_URL}/latest` → дефолт `https://api.frankfurter.app` |
| `src/hooks/usePrices.ts:50-66` | Finnhub (10 акций) | `${ENV.FINNHUB_BASE_URL}/quote?...&token=KEY` → дефолт `/api/finnhub` (через vite-proxy), **ключ в URL браузера** |
| `src/hooks/useStockPrice.ts:27` | Finnhub (1 акция) | `/api/finnhub/quote` |
| `src/hooks/useAssetPrice.ts:45` | OKX **WebSocket** (крипта realtime) | прямой `wss://ws.okx.com...` — **ТЗ: не трогать** |
| `src/hooks/useAssetPrice.ts:92` | Finnhub (акция, стр. актива) | `/api/finnhub/quote` |
| `src/hooks/useAssetPrice.ts:123` | Frankfurter (форекс, стр. актива) | `${ENV.FRANKFURTER_BASE_URL}/latest` |
| `src/hooks/useForexRate.ts` | Frankfurter | через `ENV` |

- `vite.config.ts` уже проксирует 4 префикса прямо на внешние API.
- `src/lib/env.ts` — точки переключения на бэкенд в будущем (`FINNHUB_BASE_URL`, `FRANKFURTER_BASE_URL`).
- `.gitignore` корневой паттерн `.env`/`.env.*` уже покрывает `backend/.env`.
- Архитектура (`.ai-factory/ARCHITECTURE.md`) описывает фронт без бэкенда → этот план вводит новый горизонтальный сервис вне `src/`; раздел архитектуры стоит дополнить (через docs-чекпоинт).

---

## Tasks

### Фаза 0 — Скелет проекта

#### Task #1 — Структура `backend/` + зависимости — [x]
**Файлы (новые):**
```
backend/
  app/
    __init__.py
    main.py
    config.py            # настройки: REDIS_URL, FINNHUB_API_KEY, CORS_ORIGINS
    routes/{__init__.py, quotes.py, crypto.py, forex.py}
    services/{__init__.py, cache.py, finnhub.py, okx.py, frankfurter.py}
  requirements.txt
  .env.example
  README.md
```
- `requirements.txt`: `fastapi`, `uvicorn[standard]`, `redis`, `httpx`, `python-dotenv`, `pydantic-settings`.
- `.env.example`: `FINNHUB_API_KEY=your_key_here`, `REDIS_URL=redis://localhost:6379`, `CORS_ORIGINS=http://localhost:5173`.
- **Логи:** заглушки модулей с `logger = logging.getLogger("backend.<module>")`.

#### Task #2 — `config.py` + загрузка env — [x]
**Файл:** `backend/app/config.py`.
- `pydantic-settings` BaseSettings: `FINNHUB_API_KEY: str = ""`, `REDIS_URL: str = "redis://localhost:6379"`, `CORS_ORIGINS: str = "http://localhost:5173"`. Источник — `.env` через `python-dotenv`.
- **Логи (старт):** `logger.info("[config] REDIS_URL=%s finnhub_key=%s", url, "present" if key else "ABSENT")` — сам ключ не печатать.
- **Зависит от:** #1.

---

### Фаза 1 — Кэш и сервисы

#### Task #3 — `services/cache.py` (Redis + graceful degradation) — [x]
**Файл:** `backend/app/services/cache.py`.
- `redis.asyncio` клиент из `REDIS_URL`.
- `async def get_cached(key: str) -> dict | None` — `GET` + `json.loads`, miss → `None`.
- `async def set_cached(key: str, data: dict, ttl: int) -> None` — `SET key json EX ttl`.
- **Graceful degradation:** при `ConnectionError`/таймауте — `logger.warning("[cache] unavailable: %s", err)` и работа без кэша (вернуть `None` / no-op), **не падать**.
- **Логи:** `[cache] HIT %s` / `[cache] MISS %s` / `[cache] SET %s ttl=%d`.
- **Зависит от:** #2.

#### Task #4 — `services/finnhub.py` — [x]
**Файл:** `backend/app/services/finnhub.py`.
- `httpx.AsyncClient` (timeout ~5с). `GET /quote?symbol=...&token=KEY` → нормализовать в `{symbol, price, change, changePercent, volume}` (Finnhub: `c`→price, `d`→change, `dp`→changePercent, `volume`→`0`).
- Кэш: ключ `cache:stock:{symbol}`, TTL **60с** (паттерн get→miss→fetch→set→return).
- Защита от не-finite значений (как `useAssetPrice.ts:98`).
- **Логи:** `[finnhub] fetch %s`, ошибки — `logger.warning`.
- **Зависит от:** #3.

#### Task #5 — `services/okx.py` (REST, не WebSocket) — [x]
**Файл:** `backend/app/services/okx.py`.
- `GET https://www.okx.com/api/v5/market/ticker?instId={symbol}` (напр. `BTC-USDT`).
- Нормализация в `{symbol, price, change, changePercent, volume}`: `last`, `volCcy24h`, `changePercent = ((last-open24h)/open24h)*100` с защитой `open24h>0` (тот же класс NaN%-бага, что чинили на фронте).
- Кэш `cache:crypto:{symbol}`, TTL **30с**.
- WebSocket OKX не реализуем — остаётся на фронте.
- **Логи:** `[okx] fetch %s`.
- **Зависит от:** #3.

#### Task #6 — `services/frankfurter.py` — [x]
**Файл:** `backend/app/services/frankfurter.py`.
- `GET https://api.frankfurter.app/latest?from={from}&to={to}` → `{from, to, rate}`.
- Кэш `cache:forex:{from}:{to}`, TTL **300с**.
- **Логи:** `[frankfurter] fetch %s/%s`.
- **Зависит от:** #3.

---

### Фаза 2 — Роуты и приложение

#### Task #7 — `routes/quotes.py` (акции) — [x]
**Файл:** `backend/app/routes/quotes.py`.
- `GET /api/quotes/stock/{symbol}` → `finnhub.get_quote(symbol)`.
- `GET /api/quotes/stocks?symbols=AAPL,MSFT,GOOGL` — батч: распарсить, `asyncio.gather` (кэш на каждый), частичные ошибки не валят ответ (как `Promise.allSettled` на фронте).
- 404/502 с понятным телом на отсутствующий символ / падение внешнего API.
- **Логи:** `[quotes] stock %s`, `[quotes] batch %d symbols`.
- **Зависит от:** #4.

#### Task #8 — `routes/crypto.py` + `routes/forex.py` — [x]
**Файлы:** `backend/app/routes/crypto.py`, `backend/app/routes/forex.py`.
- `GET /api/quotes/crypto/{symbol}` → `okx.get_ticker(symbol)`.
- `GET /api/quotes/forex/{from}/{to}` → `frankfurter.get_rate(from, to)`.
- **Логи:** `[crypto] %s`, `[forex] %s/%s`.
- **Зависит от:** #5, #6.

#### Task #9 — `app/main.py` (FastAPI + CORS + lifespan) — [x]
**Файл:** `backend/app/main.py`.
- `FastAPI()`, `CORSMiddleware` с `allow_origins=[CORS_ORIGINS]`, methods `["GET"]`, headers `["*"]`.
- `include_router` quotes/crypto/forex под префиксом `/api/quotes`.
- `GET /health` → `{"status":"ok"}`.
- Lifespan: открыть/закрыть Redis-пул (с учётом graceful degradation из #3).
- **Логи:** `[main] startup`, `[main] shutdown`.
- **Зависит от:** #7, #8.

---

### Фаза 3 — Стыковка фронта (без правки хуков) + финал

#### Task #10 — vite-proxy на бэкенд (Вариант A) — [x]
**Файл:** `vite.config.ts`.
- Добавить правило `'/api/quotes': { target: 'http://localhost:8000', changeOrigin: true }` (без rewrite — путь сохраняем).
- Существующие `/api/finnhub`, `/api/news`, `/api/forex`, `/api/okx` **оставить** (хуки на них опираются).
- **Зависит от:** #9.

#### Task #11 — План миграции хуков в `backend/README.md` (без правки кода) — [x]
**Файл:** `backend/README.md` (раздел «Миграция фронта»).
- По ТЗ показать `useAssetPrice.ts` / `useStockPrice.ts` / finnhub-ветку `usePrices.ts` — **уже в разделе «Контекст»**. Описать будущие шаги: `ENV.FINNHUB_BASE_URL → /api/quotes`, `/quote?symbol=X&token=…` → `/stock/X`, убрать токен из браузера. **Код хуков не меняем.**
- Запуск Redis (Docker), `pip install -r requirements.txt`, `uvicorn app.main:app --reload --port 8000`.
- **Зависит от:** #10.

#### Task #12 — Smoke-тест + docs-чекпоинт — [x]
- `cd backend && uvicorn app.main:app --reload --port 8000` — стартует без трейсбэков.
- Проверить (Redis поднят в Docker):
  - `curl localhost:8000/health`
  - `curl localhost:8000/api/quotes/stock/AAPL`
  - `curl "localhost:8000/api/quotes/stocks?symbols=AAPL,MSFT"`
  - `curl localhost:8000/api/quotes/crypto/BTC-USDT`
  - `curl localhost:8000/api/quotes/forex/EUR/USD`
  - Повтор → в логах `cache HIT`.
  - Остановить Redis → проверить graceful degradation (`cache unavailable`, ответ всё равно приходит).
- Фронт `npm run dev` работает (Вариант A ничего не сломал), `npm run test` зелёный.
- **Docs (обязательный чекпоинт через /aif-docs):** обновить «Слой данных» в `PROJECT_STATE.md` (бэкенд, TTL 60/30/300, эндпоинты, статус миграции = отложена) + дополнить `.ai-factory/ARCHITECTURE.md` упоминанием бэкенд-сервиса.
- **Зависит от:** #11.

---

## Граф зависимостей

```
#1 ─► #2 ─► #3 ─┬─► #4 ─► #7 ─┐
                ├─► #5 ──┐     ├─► #9 ─► #10 ─► #11 ─► #12
                └─► #6 ──┴► #8 ┘
```
`#4/#5/#6` независимы после `#3`. `#7` зависит от `#4`; `#8` — от `#5`,`#6`.

---

## Commit Plan

| Чекпоинт | Задачи | Сообщение |
|----------|--------|-----------|
| CP1 | #1, #2 | `feat(backend): scaffold FastAPI app + config + requirements` |
| CP2 | #3 | `feat(backend): Redis cache layer with graceful degradation` |
| CP3 | #4, #5, #6 | `feat(backend): finnhub/okx/frankfurter services with TTL cache` |
| CP4 | #7, #8, #9 | `feat(backend): quotes/crypto/forex routes + CORS app` |
| CP5 | #10, #11, #12 | `feat(backend): vite /api/quotes proxy + docs + smoke verify` |

---

## Файлы, которых план НЕ касается

- `src/` целиком, кроме `vite.config.ts` (одно новое proxy-правило). Хуки — только читаем.
- OKX **WebSocket** в `useAssetPrice.ts` — остаётся realtime-каналом на фронте (по ТЗ).
- Существующие vite-proxy правила (`/api/finnhub`, `/api/news`, `/api/forex`, `/api/okx`).
- Компоненты, страницы, тесты фронта; дизайн-система (`.ai-factory/RULES.md`).

---

## Ссылки

- `promtback.md` — исходное ТЗ
- `src/hooks/usePrices.ts`, `useStockPrice.ts`, `useAssetPrice.ts`, `useForexRate.ts` — текущий слой данных
- `src/lib/env.ts` — точки переключения на бэкенд
- `vite.config.ts` — текущая proxy-конфигурация
- `PROJECT_STATE.md` (раздел «Слой данных»), `.ai-factory/ARCHITECTURE.md` — обновить на финале
